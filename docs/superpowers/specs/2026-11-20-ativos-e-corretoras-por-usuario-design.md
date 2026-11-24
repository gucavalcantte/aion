# Ativos e corretoras cadastrados por usuário — design

## Contexto e motivo

Os usuários do AION estão abrindo contas em corretoras e mesas novas. Hoje
corretora e ativo são listas fixas no banco (enums `corretora` e `ativo`):
cada corretora ou ativo novo exige uma migração rodada à mão pelo dono do app
(foi assim com WIN, ZeroMarkets, Insinder e Goat). O objetivo é que **cada
usuário seja independente**: cadastre as próprias corretoras e ativos, vincule
um ao outro e ajuste os valores sem pedir suporte.

O valor por ponto já é por usuário e editável (`valores_ponto_corretora`, tela
Corretoras). O que muda é que corretora e ativo deixam de ser listas fixas e
passam a ser cadastros de cada usuário.

Também resolve um furo atual: os valores por ponto só foram semeados para quem
já existia quando cada migração rodou — um usuário criado depois fica sem
linhas e não consegue cadastrar trade ("Valor por ponto não cadastrado").

## Metas

- O usuário cadastra, edita e remove **ativos** e **corretoras** sozinho.
- O cadastro de valores é feito em **tick** (tamanho do tick + valor do tick),
  com o valor por ponto calculado e um **exemplo ao vivo** em dinheiro.
- Todo usuário existente continua com exatamente os ativos, corretoras e
  valores que tem hoje. Nenhum trade muda de valor.
- Usuário novo já nasce com os 7 ativos padrão.
- Qualquer ativo pode ser vinculado a corretora de qualquer moeda (há mesas
  que operam o índice em dólar).

## Fora do escopo

- Busca automática dos valores na web com IA (descartada: exigiria conta paga
  na API da Anthropic). O desenho não impede acrescentar um botão "Buscar
  valores" depois.
- Conversão entre moedas.
- Compartilhar ativos ou corretoras entre usuários — continua tudo por
  `user_id` (CLAUDE.md, seção 1).

## Seria um fracasso se…

- Algum trade, backteste ou estudo existente mudasse de valor, de ativo ou
  sumisse.
- O usuário precisasse digitar o valor por ponto e o tick como dois números
  independentes que podem se contradizer.
- Um usuário enxergasse ativo ou corretora de outro.

## Abordagens consideradas

| | Como guarda | Prós | Contras |
|---|---|---|---|
| **A — código/nome como texto** *(escolhida)* | trades, backtestes, estudos e contas continuam guardando `'MES'`, `'Ylos'`; os enums viram `text` com chave estrangeira composta `(user_id, codigo)` para o cadastro do usuário, `on update cascade` | migração pequena; dados existentes não mudam de forma; consultas e filtros quase iguais; renomear propaga sozinho | `plano.ativos` (array) não tem FK — renomear/remover ativo precisa atualizá-lo à parte |
| B — id interno (uuid) | cada tabela troca `ativo` por `ativo_id` | modelo "de livro" | reescreve a coluna de todos os trades/backtestes/estudos e todas as consultas; mais risco na migração para o mesmo resultado visível |
| ~~C — "basear em" corretora modelo / busca por IA~~ | — | — | substituídas pelo padrão no próprio ativo (abaixo) |

Escolha do usuário: **A**.

## Modelo conceitual

- **Ativo** (por usuário): código, nome, **moeda do padrão** e a
  **especificação padrão** em tick (tamanho do tick, valor do tick, unidade do
  stop). A moeda aqui só diz em que moeda estão os valores padrão — **não
  restringe** em que corretora o ativo pode ser usado.
- **Corretora** (por usuário): nome e moeda. A moeda da corretora é a moeda em
  que os valores dos ativos vinculados a ela são lidos, e é a moeda da conta.
- **Vínculo corretora × ativo** (`valores_ponto_corretora`): ao vincular, copia
  o padrão do ativo; o usuário pode ajustar só para essa corretora. É uma
  **cópia**, não herança — mudar o padrão do ativo depois não altera vínculos
  existentes. "Voltar ao padrão" recopia o padrão atual do ativo.
- **Conta**: escolhe a corretora; a moeda da conta passa a ser **a da
  corretora** (não é mais escolhida à parte).

## Banco de dados — migração `0009_ativos_e_corretoras_por_usuario.sql`

Rodada à mão no SQL Editor do Supabase, como as anteriores. Se precisar de
etapas separadas, o cabeçalho do arquivo diz quais.

### Tabela `ativos`

`id`, `user_id`, `created_at` (padrão do app) ·
`codigo text` (maiúsculas/dígitos, 1–10 caracteres) · `nome text` ·
`moeda moeda_conta` · `tamanho_tick numeric > 0` · `valor_tick numeric > 0` ·
`unidade text` (`pontos` | `dólares` | `%`) ·
`valor_ponto numeric generated always as (valor_tick / tamanho_tick) stored` ·
`unique (user_id, codigo)` · RLS "dono" igual às demais tabelas.

### Tabela `corretoras`

`id`, `user_id`, `created_at` · `nome text` (1–40 caracteres) ·
`moeda moeda_conta` · `unique (user_id, nome)` · RLS "dono".

### `valores_ponto_corretora` (existente)

- `corretora`: enum → `text`, FK `(user_id, corretora)` →
  `corretoras (user_id, nome)` `on update cascade on delete cascade`.
- `ativo`: enum → `text`, FK `(user_id, ativo)` → `ativos (user_id, codigo)`
  `on update cascade on delete cascade`.
- Novas colunas `tamanho_tick`, `valor_tick` (> 0). `valor_ponto` passa a ser
  **gerada** (`valor_tick / tamanho_tick`) — regra 6 do CLAUDE.md: nenhum
  número derivável digitado duas vezes.

### `contas`, `trades`, `backtestes`, `estudos`, `plano`

- `contas.corretora`: enum → `text`, FK para `corretoras` `on update cascade
  on delete restrict`. `contas.moeda` continua existindo (o app inteiro a lê),
  mas passa a ser **sempre igual à moeda da corretora** — garantido pelo
  banco (trigger ou FK composta incluindo a moeda; escolha do implementador).
- `trades.ativo`, `backtestes.ativo`, `estudos.ativo`: enum → `text`, FK
  `(user_id, ativo)` → `ativos` `on update cascade on delete restrict`.
- `plano.ativos`: `ativo[]` → `text[]`. Sem FK; ver "Renomear e remover".
- O trigger `definir_valor_ponto_trade` continua igual na lógica (busca o
  `valor_ponto` em `valores_ponto_corretora` pela corretora da conta e o
  ativo), só com os tipos trocados para `text`. O valor continua **congelado**
  no trade.
- Ao final, `drop type ativo` e `drop type corretora`.

### Dados existentes (backfill)

Para cada usuário em `auth.users`:

1. **Ativos**: cria os 7 com a especificação oficial do contrato:

   | Código | Nome | Moeda | Tick | Valor do tick | Unidade | = valor/ponto |
   |---|---|---|---|---|---|---|
   | MES | S&P | USD | 0,25 | 1,25 | pontos | 5 |
   | MYM | Dow | USD | 1 | 0,50 | pontos | 0,5 |
   | MNQ | Nasdaq | USD | 0,25 | 0,50 | pontos | 2 |
   | MGC | Gold | USD | 0,10 | 1,00 | pontos | 10 |
   | MCL | Oil | USD | 0,01 | 1,00 | % | 100 |
   | MBT | Bitcoin | USD | 5 | 0,50 | pontos | 0,1 |
   | WIN | Mini Índice | BRL | 5 | 1,00 | pontos | 0,2 |

2. **Corretoras**: uma para cada nome distinto que o usuário já usa em
   `valores_ponto_corretora` ou `contas`. Moeda: `B3` → BRL; demais → USD.
3. **Vínculos existentes**: mantêm `valor_ponto` **exatamente**. `tamanho_tick`
   = o tick do ativo (tabela acima); `valor_tick` = `valor_ponto ×
   tamanho_tick`. Ex.: MES na ZeroMarkets (1,00/pt) → tick 0,25, valor do tick
   0,25. Conferir na própria migração que nenhum `valor_ponto` mudou.

### Usuário novo

Trigger `after insert on auth.users` (security definer) cria os 7 ativos
padrão. Nenhuma corretora — o usuário cria as dele. O mesmo catálogo de 7
ativos é a fonte da migração e do trigger (uma função SQL só).

## Telas

### Conta (5.1) — formulário

- O seletor de **moeda some**; a moeda aparece só como informação ao lado da
  corretora escolhida ("Ylos · US$").
- O seletor de corretora lista **as corretoras do usuário**. Se ele não tiver
  nenhuma, o formulário mostra "Cadastre uma corretora primeiro" com link para
  Corretoras, no lugar do botão Criar conta.
- No topo da tela Conta: links **Corretoras** e **Ativos**.

### Ativos — `/conta/ativos` (nova)

- Lista: código, nome, moeda do padrão, tick, valor do tick, valor por ponto
  (calculado), unidade, Editar, Remover.
- Formulário "Novo ativo" / "Editar ativo": código, nome, moeda do padrão,
  tamanho do tick, valor do tick, unidade, e o **quadro de exemplo** (abaixo).
- Editar o padrão de um ativo **não** altera corretoras já vinculadas (texto
  curto no formulário dizendo isso).

### Corretoras — `/conta/corretoras` (reformulada)

- Botão **Nova corretora**: nome, moeda, e a lista dos ativos do usuário com
  caixas de marcar. Cada ativo marcado entra com o padrão dele.
- Cada corretora é um card: nome + moeda, ações **Renomear** e **Remover**, e
  a tabela dos ativos vinculados: ativo, tick, valor do tick, valor por ponto,
  unidade, **Editar** (inline, mesmo padrão "clica, edita, confirma" de hoje,
  com o quadro de exemplo), **Voltar ao padrão**, **Desvincular**.
- **Vincular ativo**: escolhe entre os ativos ainda não vinculados; entra com
  o padrão e abre já em edição.
- Quando a moeda do padrão do ativo difere da moeda da corretora (ex.: WIN
  numa mesa em US$), a linha mostra o aviso "Valores padrão do WIN estão em
  R$ — confira para US$". Sem bloqueio.

### Quadro de exemplo (Ativos e vínculos)

Recalcula enquanto o usuário digita; usa o símbolo da moeda do contexto
(moeda do padrão no Ativo, moeda da corretora no vínculo) e o nome da unidade:

```
Tamanho do tick   [ 0,10 ] ponto
Valor do tick     [ 1,00 ] US$
Unidade do stop   ( pontos ▾ )
┌───────────────────────────────────────────────┐
│ 1 tick  = 0,10 ponto  = US$ 1,00              │
│ 1 ponto = 10 ticks    = US$ 10,00             │
│ Ex.: stop de 10 pontos × 1 contrato = US$ 100 │
└───────────────────────────────────────────────┘
```

Campo vazio ou zero: o quadro mostra `—` nos valores (regra 6 do CLAUDE.md:
nunca `NaN`). Números em JetBrains Mono `tabular-nums`, como o resto do app.

### Perfomance — formulário de trade

Ativos oferecidos = **os vinculados à corretora da conta** (sem filtro por
moeda), mais o ativo do próprio trade na edição. Conta cuja corretora não tem
nenhum ativo vinculado: aviso com link para Corretoras.

### Backteste, Estudos, Plano

Listam **os ativos do usuário** (em vez da constante `ATIVOS`). A calculadora
de contratos do Backteste usa a moeda da **conta padrão** (não mais a do
ativo) para o símbolo e o valor.

## Renomear e remover

| Ação | Regra |
|---|---|
| Renomear corretora | Permitido. Propaga para contas e vínculos (cascade). Nome repetido → erro "Você já tem uma corretora com esse nome." |
| Trocar moeda da corretora | Só se **nenhuma conta** usa a corretora (senão reinterpretaria saldos e trades em outra moeda). |
| Remover corretora | Só sem contas. Leva junto os vínculos. Com contas → "Essa corretora tem contas e não pode ser removida." |
| Alterar código do ativo | Permitido. Propaga para trades, backtestes, estudos, vínculos (cascade) **e** `plano.ativos` (tratado à parte, na mesma operação). |
| Remover ativo | Só sem trades, backtestes e estudos. Leva junto os vínculos e sai de `plano.ativos`. Senão → "Esse ativo tem registros e não pode ser removido." |
| Desvincular ativo da corretora | Permitido. Trades antigos mantêm o valor congelado; a conta deixa de oferecer o ativo em trades novos. |

## Código

- `src/lib/ativos.ts`: `ATIVOS` deixa de ser a lista do app; vira só o catálogo
  do padrão (ou sai, se o SQL for a única fonte). `Ativo` e `Corretora` passam
  a ser `string`. `corretorasPorMoeda` sai.
- `src/lib/dados/ativos.ts` (novo) e `src/lib/dados/corretoras.ts`: leitura dos
  cadastros do usuário.
- Função pura para o quadro de exemplo e o valor por ponto (ex.:
  `src/lib/tick.ts`) com `tick.check.ts` no `npm run check`, cobrindo tick
  fracionário (0,25), tick maior que 1 (5), unidade `%`, campo vazio/zero.
- CLAUDE.md: atualizar seções 3.1, 3.2, 4 (`contas`, `valores_ponto_corretora`,
  novas tabelas) e 5.1. A landing `/apresentacao` fica como está.

## Verificação

- Antes/depois da migração: `valor_ponto` de todos os vínculos e de todos os
  trades idêntico; contagem de trades/backtestes/estudos por usuário idêntica.
- `npm run check`, `npm run lint`, `npm run build`.
- Manual: criar corretora nova com 3 ativos, ajustar um, voltar ao padrão;
  criar ativo novo e vinculá-lo; criar conta nela e lançar trade; vincular WIN
  numa corretora em US$; renomear corretora e código de ativo e conferir
  trades, Plano e filtros; tentar remover corretora com conta e ativo com
  trade.

## Decisões tomadas no design (não vieram do usuário — revisáveis)

- Código do ativo é gravado em maiúsculas (o usuário pode digitar "mes").
- Nome de corretora é único por usuário **sem diferenciar maiúsculas**
  ("ylos" e "Ylos" são a mesma).
- Listas de ativos (cadastro, seletores, chips do Plano) em ordem alfabética de
  código; corretoras em ordem alfabética de nome.
- Usuários existentes ficam com todas as corretoras que já têm linhas hoje
  (inclusive as que nunca usaram); podem remover as sem contas.
- Usuário novo nasce sem corretoras.

## Decisões deixadas para quem implementar

- Trigger vs FK composta para manter `contas.moeda` igual à da corretora.
- Se `plano.ativos` é atualizado por trigger em `ativos` ou pela Server Action.
- Layout exato dos formulários, dentro da identidade visual da seção 7.
