# Execuções parciais do trade — design

## Contexto

O usuário convidado (em teste) opera escalando posição: entra com N
contratos, às vezes aumenta (adição), sai em pedaços (parcial) e fecha o
resto no final. Hoje `trades` é uma linha só — um `contratos` (inteiro
fixo), um `resultado` (dólar/real digitado à mão) — sem lugar para
registrar como a posição foi montada/desmontada. Ele pediu algo parecido
com o log de execuções de outra ferramenta que já usa (imagem: Executado
em / Tipo / Quantidade / Preço / Notas), mas só com os tipos Parcial,
Adição e Saída do trade, e com a conta fechando: entrada 3 → parcial 2 +
finalização 1.

Decisão de escopo (conversada com o usuário): **isso é só documentação.**
Nenhum número hoje calculado (`resultado`, `stop_dolar`,
`resultado_pontos`, `status`, `contratos`) muda de fonte ou de fórmula.
Sem preço por execução, sem P&L calculado a partir de execuções — o
usuário continua digitando o resultado final em dólar como já faz. Isso
respeita a regra 6 do CLAUDE.md ("nenhum número derivável é digitado duas
vezes") porque não estamos introduzindo uma segunda fonte para números que
já existem — estamos só guardando o log de como a posição foi movimentada.

`contratos` continua representando o tamanho da **entrada inicial** (é o
que alimenta `stop_dolar` hoje, sem mudança). Fechamento definido com o
usuário: `contratos + Σ(Adição) = Σ(Parcial) + Σ(Saída do trade)`.

## Modelo de dados

### Novo enum `tipo_execucao_trade`

```sql
create type tipo_execucao_trade as enum ('Parcial', 'Adição', 'Saída do trade');
```

Fechado nesses três valores, mesmo padrão dos demais enums do app.

### Nova tabela `execucoes_trade`

```sql
create table public.execucoes_trade (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  trade_id   uuid not null references public.trades (id) on delete cascade,
  tipo       tipo_execucao_trade not null,
  quantidade integer not null check (quantidade > 0),
  ordem      integer not null,
  notas      text
);

create index execucoes_trade_trade on public.execucoes_trade (user_id, trade_id, ordem);

alter table public.execucoes_trade enable row level security;
create policy "dono" on public.execucoes_trade
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Mesmo padrão de RLS "dono" das demais tabelas. `on delete cascade` em
`trade_id`: apagar o trade apaga as execuções dele, sem lixo órfão — já é
o comportamento esperado hoje ao remover um trade.

`ordem` é só a posição de exibição (a ordem em que o usuário adicionou as
linhas no formulário) — não representa horário nem impõe sequência
obrigatória de tipos. Não há coluna de horário por execução: o trade já
tem `hora_inicio`/`hora_fim` (entrada e saída do trade como um todo,
seção 4 do CLAUDE.md) e adicionar um terceiro nível de tempo por execução
não foi pedido e contradiria a decisão já tomada de "não existe duração,
só dois horários".

**Sem tabela de preço.** Diferente da imagem de referência, não existe
coluna `preco` — decisão de escopo acima.

### `trades`: nenhuma coluna nova

`contratos`, `resultado`, `stop_dolar`, `resultado_pontos`, `status`,
`valor_ponto` continuam exatamente como estão. `execucoes_trade` é
puramente aditiva e opcional — um trade sem nenhuma linha em
`execucoes_trade` se comporta hoje exatamente como sempre se comportou.

## Regra de fechamento (validação, não cálculo)

Com o checkbox "Teve parciais ou adições" marcado:

- `contratos (do trade) + Σ(quantidade onde tipo = 'Adição') = Σ(quantidade onde tipo = 'Parcial') + Σ(quantidade onde tipo = 'Saída do trade')`
- Precisa existir **pelo menos uma** execução do tipo `'Saída do trade'`
  (é o que fecha a posição — sem isso, sobra contrato aberto sem
  explicação).
- Quantidade de cada execução é inteiro `> 0` (mesma regra de `contratos`).
- Ordem das linhas não é validada (não force o usuário a inserir "Saída
  do trade" por último) — só a soma e a presença de ao menos uma saída.

Essa conta roda em dois lugares:

1. **Client**, ao vivo, no formulário — feedback imediato ("faltam 2
   contratos" / "✓ fecha certo"), bloqueia o botão de salvar enquanto não
   fechar.
2. **Server action**, antes de gravar — nunca confia só no client. Se o
   checkbox vier marcado e a conta não fechar (ou faltar `'Saída do
   trade'`), retorna erro e não grava nada (nem o trade, nem as
   execuções) — mesmo padrão de validação que `salvarTrade` já usa hoje
   para `resultado`/`pontos_stop`.

Se o checkbox vier desmarcado, `execucoes_trade` daquele trade é
zerada (delete de todas as linhas existentes) — evita ficar com um log
"fantasma" desatualizado depois que o usuário decide que não quer mais
detalhar aquele trade.

## Server action (`src/app/(app)/perfomance/acoes.ts`)

`salvarTrade` (create e edit) passa a:

1. Ler as execuções enviadas pelo formulário (lista de `{ tipo,
   quantidade, notas }`, na ordem de envio).
2. Se houver alguma execução ou o checkbox vier marcado: validar a regra
   de fechamento acima usando o `contratos` do próprio payload (antes de
   gravar o trade). Erro de validação aborta tudo, mesmo formato de
   `EstadoTrade` (`{ erro: string }`) já usado.
3. Gravar/atualizar o trade como já faz hoje.
4. Substituir as execuções daquele `trade_id`: `delete` de todas as linhas
   existentes + `insert` das novas com `ordem` = posição na lista enviada.
   Simples e correto para o volume (poucas linhas por trade); não precisa
   de diffing por id porque o formulário sempre reenvia a lista inteira.

Nova função de leitura em `src/lib/dados/trades.ts` (ou um novo módulo
colocado ao lado, `src/lib/dados/execucoes-trade.ts` — decisão de
organização de arquivo fica para a implementação): busca as execuções de
um conjunto de `trade_id`s de uma vez (não uma query por trade) para
alimentar tanto o indicador da tabela quanto a expansão de linha.

## Tipos (`src/lib/dados/trades.ts` ou novo módulo)

```ts
export type TipoExecucaoTrade = "Parcial" | "Adição" | "Saída do trade";

export type ExecucaoTrade = {
  id: string;
  tipo: TipoExecucaoTrade;
  quantidade: number;
  ordem: number;
  notas: string | null;
};
```

`Trade` (tipo existente) não muda — a lista de execuções é buscada à
parte e associada por `trade_id` na camada de dados da Perfomance, não
embutida no tipo `Trade` em si (evita carregar um array em todo lugar que
usa `Trade` hoje, como o Backteste ou cálculos que nada têm a ver com
isso).

## Formulário (`src/app/(app)/perfomance/formulario-trade.tsx`)

- Checkbox "Teve parciais ou adições", posicionado logo abaixo do campo
  Contratos.
- Marcado, revela uma lista repetível abaixo (mesmo dialog, sem abrir
  outro modal): cada linha com **Tipo** (select: Parcial / Adição / Saída
  do trade), **Quantidade** (input numérico) e **Notas** (input de texto,
  opcional) + botão de remover linha. Botão "+ Adicionar execução" no
  final da lista.
- Indicador de fechamento ao vivo, logo abaixo da lista: soma corrente
  contra o alvo (`contratos + adições`), com texto tipo "faltam 2
  contratos" (estado neutro) até fechar ("✓ soma bate"); fica em estado de
  alerta (mesma cor de perda da paleta) se a soma ultrapassar o alvo.
  Botão salvar do formulário fica desabilitado enquanto o checkbox está
  marcado e a conta não fecha, ou não existe nenhuma linha `'Saída do
  trade'`.
- Editar um trade existente pré-popula o checkbox (marcado se havia
  execuções) e a lista com as execuções salvas, na mesma `ordem`.
- Sem preço, sem data/hora por linha — só os três campos acima.

## Listagem da Perfomance (`src/app/(app)/perfomance/tabela-trades.tsx`)

- Nova célula pequena (ícone + contagem, ex. "3") na linha do trade,
  visível só quando aquele trade tem execuções — trades sem execuções
  ficam com a célula vazia, sem mudança visual.
- Clicar expande a linha (mesmo padrão de disclosure, sem navegação):
  mostra a lista das execuções daquele trade em modo leitura (Tipo ·
  Quantidade · Notas), na `ordem` salva. Não abre o formulário de edição
  — só visualização; editar continua sendo a ação "Editar" que já existe.
- Não mexe nas 15 colunas atuais nem na paginação/rolagem horizontal já
  existentes.

## Fora de escopo

- Preço por execução e cálculo de `resultado` a partir de execuções.
- Horário por execução (usa só `hora_inicio`/`hora_fim` do trade).
- Validação de ordem/sequência dos tipos (ex.: obrigar que "Saída do
  trade" seja a última linha).
- Mudar o significado de `contratos` para "pico da posição" — continua
  sendo o tamanho da entrada inicial.
- Refletir execuções no Backteste (backteste não tem esse conceito nem
  foi pedido).
- Refletir execuções em qualquer card/gráfico de estatística da
  Perfomance (assertividade, R:R, drawdown etc. — regra 6 do CLAUDE.md,
  nada muda de fonte).

## CLAUDE.md

Seção 4 (schema `trades`) ganha uma nota curta apontando a tabela nova
`execucoes_trade` como log opcional de como a posição foi
montada/desmontada, deixando explícito que é só documentação e não altera
`contratos`/`resultado`/nenhum campo calculado.

## Testes

- Teste manual, depois de rodar a migração:
  1. Criar um trade com 3 contratos, marcar o checkbox, adicionar Parcial
     (2) e Saída do trade (1) — soma fecha, salva sem erro.
  2. Tentar salvar com soma incompleta (ex. só Parcial 2, sem Saída do
     trade) — botão de salvar fica bloqueado no client.
  3. Forçar o mesmo caso incompleto direto na server action (ou tirar o
     bloqueio do client temporariamente) — confirma que o server também
     rejeita e não grava nem o trade nem execuções.
  4. Trade com Adição: entrada 2, Adição 1, Parcial 2, Saída do trade 1 —
     fecha certo (2+1 = 2+1).
  5. Editar um trade com execuções salvas: lista vem pré-populada na
     ordem certa; desmarcar o checkbox e salvar apaga as execuções
     daquele trade.
  6. Listagem da Perfomance: trade com execuções mostra o indicador;
     clicar expande e mostra tipo/quantidade/notas; trade sem execuções
     não mostra nada. `stop_dolar`, `resultado`, `status`, assertividade
     e demais cards continuam idênticos a antes da feature (nenhum
     recálculo).
