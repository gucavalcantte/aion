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

## A unidade do stop também passa a ser por corretora

Descoberta durante o levantamento comparativo: a ZeroMarkets mede o stop do
Oil (MCL) em **pontos**, não em **%** como a Ylos. Ou seja, `unidade` — o
rótulo que hoje `ativos.ts` trata como fixo por ativo ("pontos", "dólares"
ou "%") — na verdade também é uma característica da corretora, não só do
ativo. Para os outros seis ativos as duas corretoras concordam ("pontos"),
mas o dado que sustenta isso passa a viver por corretora, não só por ativo
— senão o MCL fica sem como representar as duas convenções ao mesmo tempo.

Consequência: `unidade` sai de `ATIVOS` e passa a viver em
`valores_ponto_corretora`, junto do `valor_ponto` — as duas colunas juntas
são a especificação de como aquele ativo se mede e se precifica *naquela*
corretora. `ATIVOS` fica só com o que é mesmo fixo do ativo: `nome` e
`moeda`.

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
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  corretora corretora not null,
  ativo ativo not null,
  valor_ponto numeric not null,
  unidade text not null, -- 'pontos' | 'dólares' | '%'

  unique (user_id, corretora, ativo)
);

alter table public.valores_ponto_corretora enable row level security;
create policy "dono" on public.valores_ponto_corretora
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Uma linha por ativo aplicável a cada corretora: Ylos e ZeroMarkets cobrem os
seis ativos em USD; B3 cobre só WIN. `unidade` é o rótulo do campo de stop
para esse ativo *nessa* corretora (ver seção acima) — na prática só MCL
varia (`%` na Ylos, `pontos` na ZeroMarkets); os demais repetem `pontos` em
toda corretora que os cobre. Essa tabela é o que a nova tela "Corretoras"
lista e edita.

**Por usuário, não global.** CLAUDE.md (seção 1) é explícito: "nada é
compartilhado — nem os setups". Sem `user_id` aqui, um usuário editando o
valor da ZeroMarkets mudaria silenciosamente o cálculo de trades dos
outros dois. Mesmo padrão `user_id` + RLS "dono" das demais tabelas —
`especificacoesDaCorretora`/`listarCorretoras`/`atualizarEspecificacao`
não precisam filtrar por usuário explicitamente, o banco já recusa ver ou
editar a linha de outro (mesmo padrão que `contasParaSeletor` já usa hoje,
sem `.eq("user_id", …)` nas queries).

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

Como a tabela é por usuário, o seed cruza os três usuários existentes com
os valores acima — cada um nasce com sua própria cópia, editável depois
sem afetar os outros dois:

```sql
insert into public.valores_ponto_corretora (user_id, corretora, ativo, valor_ponto, unidade)
select u.id, v.corretora, v.ativo, v.valor_ponto, v.unidade
from auth.users u
cross join (values
  ('Ylos'::corretora, 'MES'::ativo, 5.0,   'pontos'),
  ('Ylos'::corretora, 'MYM'::ativo, 0.5,   'pontos'),
  ('Ylos'::corretora, 'MNQ'::ativo, 2.0,   'pontos'),
  ('Ylos'::corretora, 'MGC'::ativo, 10.0,  'pontos'),
  ('Ylos'::corretora, 'MCL'::ativo, 100.0, '%'),
  ('Ylos'::corretora, 'MBT'::ativo, 0.1,   'pontos'),
  ('B3'::corretora,   'WIN'::ativo, 0.2,   'pontos'),
  ('ZeroMarkets'::corretora, 'MES'::ativo, 1.0,   'pontos'),
  ('ZeroMarkets'::corretora, 'MYM'::ativo, 1.0,   'pontos'),
  ('ZeroMarkets'::corretora, 'MNQ'::ativo, 1.0,   'pontos'),
  ('ZeroMarkets'::corretora, 'MGC'::ativo, 100.0, 'pontos'),
  -- placeholder: valor real da ZeroMarkets ainda não confirmado, ver nota acima; unidade já é 'pontos', confirmada
  ('ZeroMarkets'::corretora, 'MCL'::ativo, 100.0, 'pontos'),
  ('ZeroMarkets'::corretora, 'MBT'::ativo, 1.0,   'pontos')
) as v(corretora, ativo, valor_ponto, unidade);
```

Um usuário futuro (o app já documenta que contas são criadas manualmente
no painel do Supabase) precisa do mesmo seed rodado manualmente pra ele —
igual a qualquer outro cadastro inicial hoje ("banco começa zerado").

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
  where user_id = new.user_id and corretora = corretora_da_conta and ativo = new.ativo;

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

`ATIVOS` perde os campos `valorPonto` e `unidade` (mantém `nome` e `moeda`
— esses sim continuam fixos por ativo, independente de corretora).
`unidadeDoStop(codigo)` deixa de existir como função pura — vira parte do
retorno das funções de `corretoras.ts`, já que agora depende também de
qual corretora. Novo tipo `Corretora = "Ylos" | "ZeroMarkets" | "B3"` e
helper `corretorasPorMoeda(moeda: Moeda): Corretora[]` — retorna `["Ylos",
"ZeroMarkets"]` para USD e `["B3"]` para BRL. Usado tanto no formulário de
Conta (filtrar as opções) quanto na tela de Corretoras (agrupar por
moeda).

### `src/lib/dados/corretoras.ts` (novo)

Data access da nova tabela. Cada ativo de uma corretora carrega valor por
ponto **e** unidade juntos — as duas colunas descrevem a mesma
especificação de contrato:

```ts
type EspecificacaoAtivo = { valorPonto: number; unidade: string };
```

- `especificacoesDaCorretora(corretora): Promise<Record<Ativo, EspecificacaoAtivo>>`
  — usado pelo Backteste e pelo formulário de trade.
- `listarCorretoras(): Promise<{ corretora: Corretora; ativos: (EspecificacaoAtivo & { ativo: Ativo })[] }[]>`
  — usado pela tela de Corretoras.
- `atualizarEspecificacao(corretora, ativo, valorPonto, unidade)` (Server
  Action) — usada pela edição inline da tela de Corretoras.

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
corretora, busca `especificacoesDaCorretora(corretora)`; passa esse mapa
para `TabelaBackteste`. Isso substitui as duas leituras de `ATIVOS.find(...).unidade`
que hoje existem em `tabela.tsx` (linha do rótulo do stop no cadastro
inline, e a linha de exibição do valor cadastrado) — ambas passam a ler o
mapa vindo da conta padrão em vez de `ATIVOS`. `ValorStopDolar` passa a
receber `{ valorPonto, unidade }: EspecificacaoAtivo | null` como prop em
vez de ler `dadosAtivo.valorPonto`/`dadosAtivo.unidade`. Sem conta padrão
com corretora resolvida, cai no valor/unidade da Ylos (mesmo
comportamento de fallback já descrito para o valor por ponto).

### `src/app/(app)/perfomance/page.tsx` e `formulario-trade.tsx`

`page.tsx` busca `especificacoesDaCorretora(conta.corretora)` para a conta
selecionada e passa como prop (`especificacoes: Record<Ativo,
EspecificacaoAtivo>`) para `FormularioTrade`, que troca:

- `stopEmDolar(p, ativo, c)` por `stopEmDolar(p, especificacoes[ativo].valorPonto, c)`
  no cálculo de preview (o valor final de verdade continua vindo do
  trigger, no banco — isso aqui é só o número que o formulário mostra
  antes de salvar);
- a leitura `ATIVOS.find((a) => a.codigo === ativo)?.unidade` pelo rótulo
  vindo de `especificacoes[ativo].unidade`.

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
em USD; B3: só WIN), com **valor por ponto e unidade** editáveis inline
por linha — mesmo padrão de "clica, edita a célula, confirma" já usado no
cadastro inline do Backteste (CLAUDE.md, seção 5.2); a unidade é um select
fechado (`pontos` | `dólares` | `%`), não texto livre. Cada edição chama
`atualizarEspecificacao` e revalida a página; como a tabela é por
corretora (não por conta), o aviso de que "isso vale para todas as contas
dessa corretora" fica no cabeçalho de cada cartão.

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

- **Seção 3.2** — a tabela de ativos deixa de ter colunas únicas de "valor
  do ponto" e "unidade"; ambas passam a ser por corretora, vivem em
  `valores_ponto_corretora`, e a tabela em `ativos.ts` guarda só
  nome/moeda (o que é mesmo fixo do ativo). Registrar explicitamente que o
  Oil (MCL) é medido em `%` na Ylos e em `pontos` na ZeroMarkets — é o
  caso que motivou unidade deixar de ser fixa por ativo.
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
     cinco reais da ZeroMarkets + o placeholder de MCL) e o MCL da
     ZeroMarkets já aparece com unidade `pontos` (não `%`).
  3. Criar uma conta ZeroMarkets, lançar um trade em MES, conferir que
     `stop_dolar` bate com US$1,00/pt (não US$5,00/pt da Ylos), e que o
     campo de stop no formulário de trade para MCL nessa conta mostra
     "Stop em pontos" em vez de "Stop em %".
  4. Editar o valor de MES da ZeroMarkets depois desse trade salvo:
     o trade antigo não muda; um trade novo já usa o valor atualizado.
  5. Marcar a conta ZeroMarkets como padrão e abrir o Backteste: o
     tooltip de contratos ideais passa a refletir o valor da ZeroMarkets.
