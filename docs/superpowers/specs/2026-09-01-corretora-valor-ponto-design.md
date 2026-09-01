# Corretora e valor por ponto por corretora — design

## Contexto

O AION assume hoje um único valor por ponto por ativo, fixo no código
(`ATIVOS` em `src/lib/ativos.ts`, espelhado na função SQL
`valor_do_ponto(ativo)`). Esses números vêm da Ylos. O usuário vai passar a
operar também pela **ZeroMarkets**, cuja especificação de contrato ("lote")
para os mesmos ativos vale um valor por ponto diferente — às vezes bem
diferente (ex.: MES: US$5,00/pt na Ylos, US$1,00/pt na ZeroMarkets).

Isso quebra a premissa de "constante da aplicação, não editável pelo
usuário" (CLAUDE.md, seção 3.2): o valor por ponto passa a depender de qual
corretora executa a conta, não só do ativo.

## Dois conceitos que não podem se confundir

- **Moeda do ativo** (`ativos.ts`, enum `ativo`): fixa — WIN é BRL, os
  outros seis são USD. Não muda com este trabalho.
- **Corretora da conta** (`contas.corretora`, novo campo): de qual corretora
  a conta opera. Determina qual tabela de valor-por-ponto vale para os
  trades daquela conta, e é filtrada pela moeda da conta — uma conta em
  dólar só pode ser Ylos ou ZeroMarkets; uma conta em real só pode ser B3
  (única praça do WIN).

## Modelo de dados

### Novo enum `corretora`

```sql
create type corretora as enum ('Ylos', 'ZeroMarkets', 'B3');
```

Fechado nesses três valores — mesmo padrão de `tipo_conta`/`moeda_conta`.
Adicionar uma quarta corretora no futuro é uma migration, assim como
qualquer outro enum do app.

### Nova tabela `valores_ponto_corretora`

```sql
create table public.valores_ponto_corretora (
  corretora corretora not null,
  ativo ativo not null,
  valor_ponto numeric not null,
  primary key (corretora, ativo)
);
```

Uma linha por ativo aplicável a cada corretora: Ylos e ZeroMarkets cobrem os
seis ativos em USD; B3 cobre só WIN. Essa tabela é o que a nova tela
"Corretoras" lista e edita.

### `contas.corretora`

```sql
alter table public.contas add column corretora corretora not null default 'Ylos';
update public.contas set corretora = 'B3' where moeda = 'BRL';
```

Contas existentes em USD ficam Ylos (o que já valia, implicitamente, antes
de existir o conceito); a conta em BRL (WIN) fica B3. Nenhuma migração
manual de dado é necessária.

### Seed de `valores_ponto_corretora`

Ylos e B3 recebem os valores atuais de `ATIVOS`. ZeroMarkets recebe os
valores reais que o usuário já levantou num comparativo prévio — exceto
Oil (MCL), que ele sinalizou como incorreto nesse levantamento; para não
gravar um número sabidamente errado, MCL da ZeroMarkets nasce igual ao da
Ylos (100,00), como placeholder a corrigir na tela de Corretoras assim que
o valor certo for confirmado.

```sql
insert into public.valores_ponto_corretora (corretora, ativo, valor_ponto) values
  ('Ylos', 'MES', 5.0),
  ('Ylos', 'MYM', 0.5),
  ('Ylos', 'MNQ', 2.0),
  ('Ylos', 'MGC', 10.0),
  ('Ylos', 'MCL', 100.0),
  ('Ylos', 'MBT', 0.1),
  ('B3',   'WIN', 0.2),
  ('ZeroMarkets', 'MES', 1.0),
  ('ZeroMarkets', 'MYM', 1.0),
  ('ZeroMarkets', 'MNQ', 1.0),
  ('ZeroMarkets', 'MGC', 100.0),
  ('ZeroMarkets', 'MCL', 100.0), -- placeholder: valor real da ZeroMarkets ainda não confirmado, ver nota acima
  ('ZeroMarkets', 'MBT', 1.0);
```

### `trades`: congelar o valor no momento do registro

`stop_dolar` e `resultado_pontos` hoje são *generated columns* que chamam
`valor_do_ponto(ativo)` — uma função pura, sem acesso a outras tabelas.
Postgres não permite que uma generated column consulte outra tabela, então
não dá para ela decidir "qual corretora essa conta usa" sozinha. A saída é
gravar o valor por ponto **na própria linha do trade**, resolvido no
momento do insert/update, e fazer as duas colunas geradas dependerem dessa
coluna da própria linha em vez da função:

```sql
alter table public.trades add column valor_ponto numeric;

-- Backfill: até aqui só existia o valor da Ylos, para todo mundo.
update public.trades set valor_ponto = valor_do_ponto(ativo);

alter table public.trades alter column valor_ponto set not null;

create or replace function public.definir_valor_ponto_trade()
returns trigger
language plpgsql
as $$
declare
  corretora_da_conta corretora;
  vp numeric;
begin
  select corretora into corretora_da_conta
  from public.contas where id = new.conta_id;

  select valor_ponto into vp
  from public.valores_ponto_corretora
  where corretora = corretora_da_conta and ativo = new.ativo;

  if vp is null then
    raise exception 'Valor por ponto não cadastrado para % / %', corretora_da_conta, new.ativo;
  end if;

  new.valor_ponto := vp;
  return new;
end;
$$;

create trigger trg_valor_ponto_trade
  before insert or update of conta_id, ativo on public.trades
  for each row execute function public.definir_valor_ponto_trade();

-- Recriar as duas colunas geradas para usarem a coluna da própria linha:
alter table public.trades drop column stop_dolar;
alter table public.trades drop column resultado_pontos;
alter table public.trades add column stop_dolar numeric
  generated always as (pontos_stop * valor_ponto * contratos) stored;
alter table public.trades add column resultado_pontos numeric
  generated always as (resultado / nullif(valor_ponto * contratos, 0)) stored;
```

Efeito prático: `valor_ponto` é preenchido sozinho pelo trigger, nunca
digitado pelo usuário — mesmo espírito de `stop_dolar` hoje. Editar o valor
por ponto de uma corretora depois **não** muda trades já registrados
(congelado no momento do cadastro); só passa a valer para trades novos. Se
o usuário trocar a conta ou o ativo de um trade já salvo, o trigger
recalcula o snapshot com o valor vigente naquele momento — comportamento
consistente com "o valor vale para o que está sendo salvo agora".

Diferente da migração 0002, esta não mexe em `ALTER TYPE ... ADD VALUE`
(o enum `corretora` é criado do zero), então não precisa ser rodada em duas
etapas — um arquivo, uma transação.

## Backteste: só sugestão, nada persistido

`backtestes` não tem `conta_id` e não tem colunas em dólar geradas — o
valor por ponto ali só alimenta o tooltip de "contratos ideais para o
MLPT" (`ValorStopDolar` em `backteste/[tempo]/tabela.tsx`), calculado no
client a partir de `ATIVOS`. Sem mudança de schema nessa tabela.

O que muda: em vez de ler `dadosAtivo.valorPonto` (constante fixa), o
tooltip passa a receber o valor por ponto já resolvido pelo servidor a
partir da **conta padrão** (`is_padrao = true`) — a mesma conta que hoje já
fornece o MLPT para esse cálculo. Sem conta padrão marcada, ou sem valor
cadastrado para aquele ativo na corretora dela, cai no valor da Ylos (o
comportamento de hoje, sem quebrar).

## Código TypeScript

### `src/lib/ativos.ts`

`ATIVOS` perde o campo `valorPonto` (mantém `nome`, `unidade`, `moeda` —
esses continuam fixos). Novo tipo `Corretora = "Ylos" | "ZeroMarkets" |
"B3"` e helper `corretorasPorMoeda(moeda: Moeda): Corretora[]` — retorna
`["Ylos", "ZeroMarkets"]` para USD e `["B3"]` para BRL. Usado tanto no
formulário de Conta (filtrar as opções) quanto na tela de Corretoras
(agrupar por moeda).

### `src/lib/dados/corretoras.ts` (novo)

Data access da nova tabela:

- `valoresPontoDaCorretora(corretora): Promise<Record<Ativo, number>>` —
  usado pelo Backteste e pelo formulário de trade.
- `listarCorretoras(): Promise<{ corretora: Corretora; valores: { ativo: Ativo; valorPonto: number }[] }[]>`
  — usado pela tela de Corretoras.
- `atualizarValorPonto(corretora, ativo, valorPonto)` (Server Action) —
  usada pela edição inline da tela de Corretoras.

### `src/lib/metricas.ts`

`stopEmDolar` e `resultadoEmPontos` passam a receber o valor por ponto já
resolvido, em vez de olhar `ATIVOS` internamente — o arquivo continua "sem
conhecer banco":

```ts
export function stopEmDolar(pontosStop: number, valorPonto: number, contratos: number): number {
  return pontosStop * valorPonto * contratos;
}

export function resultadoEmPontos(resultado: number, valorPonto: number, contratos: number): number | null {
  const divisor = valorPonto * contratos;
  if (divisor === 0) return null;
  return resultado / divisor;
}
```

### `src/lib/dados/contas.ts`

`mlptDaContaPadrao()` vira `contaPadraoParaBackteste()`, devolvendo
`{ mlpt: number | null; corretora: Corretora | null }` em vez de só o
número. `listarContas`/`buscarConta` passam a incluir `corretora` (mesmo
padrão hoje usado para `moeda`, com fallback pro valor coerente com a
moeda quando a coluna vier nula de alguma linha antiga).

### `src/app/(app)/backteste/[tempo]/page.tsx` e `tabela.tsx`

`page.tsx` troca a chamada por `contaPadraoParaBackteste()` e, se houver
corretora, busca `valoresPontoDaCorretora(corretora)`; passa esse mapa para
`TabelaBackteste`. `ValorStopDolar` passa a receber `valorPonto: number |
null` como prop em vez de ler `dadosAtivo.valorPonto`.

### `src/app/(app)/perfomance/page.tsx` e `formulario-trade.tsx`

`page.tsx` busca `valoresPontoDaCorretora(conta.corretora)` para a conta
selecionada e passa como prop (`valoresPonto: Record<Ativo, number>`) para
`FormularioTrade`, que troca `stopEmDolar(p, ativo, c)` por
`stopEmDolar(p, valoresPonto[ativo], c)` no cálculo de preview (o valor
final de verdade continua vindo do trigger, no banco — isso aqui é só o
número que o formulário mostra antes de salvar).

### `src/lib/tipos.ts`

`Conta` ganha `corretora: Corretora`.

## Telas

### Formulário de Conta (`conta/formulario.tsx`, `conta/acoes.ts`)

Novo fieldset "Corretora", mesmo padrão visual do de Moeda (radio em
grupo), com as opções filtradas por `corretorasPorMoeda(moedaSelecionada)`.
Trocar a moeda e a corretora selecionada deixar de ser válida reseta a
seleção para a primeira opção válida da nova moeda (evita mandar um par
moeda/corretora incoerente). `salvarConta` valida que a corretora enviada
está entre as permitidas para a moeda escolhida antes de gravar.

### Tela "Corretoras" (nova, `conta/corretoras/`)

Acessível por um link no topo da tela de Conta. Lista as três corretoras,
cada uma com a tabela dos ativos que ela cobre (Ylos/ZeroMarkets: os seis
em USD; B3: só WIN) e o valor por ponto editável inline — mesmo padrão de
"clica, edita a célula, confirma" já usado no cadastro inline do Backteste
(CLAUDE.md, seção 5.2). Cada edição chama `atualizarValorPonto` e revalida
a página; como a tabela é por corretora (não por conta), o aviso de que
"isso vale para todas as contas dessa corretora" fica no cabeçalho de cada
cartão.

## Fora de escopo

- Conversão entre moedas continua não existindo — decisão já tomada no
  spec anterior (moeda por conta).
- Uma conta continua ligada a exatamente uma corretora; não há conceito de
  trocar de corretora "por trade".
- O valor real da ZeroMarkets para Oil (MCL) fica como placeholder (igual
  Ylos) até o usuário confirmar o número certo e corrigir pela tela de
  Corretoras — não é travado nem validado pelo app.
- Adicionar uma quarta corretora, ou mais de uma corretora por moeda além
  das já prontas, fica para quando surgir a necessidade — o enum é fechado
  de propósito, como os demais do app.

## CLAUDE.md

Duas seções precisam de atualização (no `aion/CLAUDE.md`, fonte de
verdade):

- **Seção 3.2** — a tabela de ativos deixa de ter uma coluna única de
  "valor do ponto"; passa a dizer que o valor por ponto é por corretora,
  vive em `valores_ponto_corretora`, e a tabela em `ativos.ts` guarda só
  nome/unidade/moeda (metadado fixo do ativo, não o valor monetário).
- **Seção 4** (schema `contas`) — novo campo `corretora`, com a mesma nota
  de trava por moeda já usada para o campo `moeda`. `trades` ganha
  `valor_ponto` (preenchido por trigger, não digitado) na lista de "campos
  calculados, nunca digitados".
- **Seção 5** — nova tela "Corretoras" na lista de telas do app (5.x,
  acessível a partir de Conta).

## Testes

- `lib/metricas.check.ts`: atualizar os casos de `stopEmDolar` e
  `resultadoEmPontos` para a nova assinatura (valor por ponto como
  parâmetro, não mais implícito por `ATIVOS`).
- Teste manual, depois de rodar a migração:
  1. Contas existentes: Ylos para as em USD, B3 para a em BRL.
  2. Tela Corretoras mostra os três cartões com os valores seedados (os
     cinco reais da ZeroMarkets + o placeholder de MCL).
  3. Criar uma conta ZeroMarkets, lançar um trade em MES, conferir que
     `stop_dolar` bate com US$1,00/pt (não US$5,00/pt da Ylos).
  4. Editar o valor de MES da ZeroMarkets depois desse trade salvo:
     o trade antigo não muda; um trade novo já usa o valor atualizado.
  5. Marcar a conta ZeroMarkets como padrão e abrir o Backteste: o
     tooltip de contratos ideais passa a refletir o valor da ZeroMarkets.
