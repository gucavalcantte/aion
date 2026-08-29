# Moeda por conta + terceiro usuário (WIN) — design

## Contexto

O AION hoje assume dólar em todo lugar: uma única função `moeda()` em
`src/lib/formato.ts` prefixa qualquer valor com `$`, usada em 33 pontos do
app (Conta, Perfomance, Plano, calendário, gráficos, Backteste).

Um amigo vai testar o app operando **WIN** (Mini Índice, B3), negociado em
Real. O dono e a esposa continuam operando só ativos em dólar. Isso exige
dois pedaços de trabalho amarrados:

1. **WIN precisa existir de fato no código** — hoje só foi adicionado ao
   `CLAUDE.md` da raiz do monorepo (`../CLAUDE.md`), que **não é** o arquivo
   que o código referencia. O `aion/CLAUDE.md` (fonte de verdade real,
   citado por `src/lib/ativos.ts`), o enum `ativo` do Postgres, e
   `ATIVOS` em `ativos.ts` ainda não têm WIN.
2. **Moeda por conta** — cada conta passa a declarar em que moeda opera
   (Dólar ou Real), e toda exibição de dinheiro daquela conta segue essa
   moeda.

## Terceiro usuário

O amigo ganha um usuário real no Supabase Auth, criado manualmente como já
é feito hoje para os dois usuários existentes. RLS já filtra por `user_id`
em todas as tabelas — nenhuma mudança de código é necessária além de
atualizar a linguagem do `CLAUDE.md` que hoje fala em "dois usuários"
(seções 1, 2 e 5.0).

## Dois conceitos de moeda — não confundir

- **Moeda nativa do ativo** (`ativos.ts`, enum `ativo`): fixa, definida
  pela bolsa onde o ativo negocia. WIN = BRL; os outros seis = USD.
- **Moeda da conta** (`contas.moeda`, novo campo): escolhida pelo usuário
  ao cadastrar a conta. Determina em que moeda `saldo_inicial`, `meta`,
  `mlpt`, `mlpd`, `saldo_atual` e o resultado dos trades daquela conta são
  **exibidos**.

O app não converte entre moedas. A consistência entre as duas (uma conta em
BRL só faz sentido operando WIN) é mantida por uma trava de UI, não por
validação de banco — ver seção "Trava ativo × moeda".

## Mudanças de dado

### `ativos.ts`
Adicionar `moeda: "USD" | "BRL"` a cada entrada e a linha do WIN:

```ts
export const ATIVOS = [
  { codigo: "MES", nome: "S&P",     valorPonto: 5,   unidade: "pontos", moeda: "USD" },
  { codigo: "MYM", nome: "Dow",     valorPonto: 0.5, unidade: "pontos", moeda: "USD" },
  { codigo: "MNQ", nome: "Nasdaq",  valorPonto: 2,   unidade: "pontos", moeda: "USD" },
  { codigo: "MGC", nome: "Gold",    valorPonto: 10,  unidade: "pontos", moeda: "USD" },
  { codigo: "MCL", nome: "Oil",     valorPonto: 100, unidade: "%",      moeda: "USD" },
  { codigo: "MBT", nome: "Bitcoin", valorPonto: 0.1, unidade: "pontos", moeda: "USD" },
  { codigo: "WIN", nome: "Mini Índice", valorPonto: 0.2, unidade: "pontos", moeda: "BRL" },
] as const;
```

Novo helper `moedaDoAtivo(codigo: Ativo): "USD" | "BRL"`.

### Migração SQL (`supabase/migracoes/0002_win_e_moeda.sql`)

- `alter type ativo add value 'WIN';` (fora de bloco de transação com o
  resto — regra do Postgres para `ADD VALUE`)
- Atualizar `valor_do_ponto(a ativo)` incluindo `when 'WIN' then 0.2`
- `create type moeda_conta as enum ('USD', 'BRL');`
- `alter table public.contas add column moeda moeda_conta not null default 'USD';`

Contas existentes (dono e esposa) ficam `USD` automaticamente — nenhuma
migração de dado manual necessária.

### Tipos (`src/lib/tipos.ts`)
`Conta` e `ContaComSaldo` ganham `moeda: "USD" | "BRL"`.

## Formatação (`src/lib/formato.ts`)

```ts
const SIMBOLO: Record<"USD" | "BRL", string> = { USD: "$", BRL: "R$" };

export function moeda(valor: number | null | undefined, moeda: "USD" | "BRL", comSinal = false) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return VAZIO;
  const sinal = comSinal && valor > 0 ? "+" : valor < 0 ? "-" : "";
  return `${sinal}${SIMBOLO[moeda]}${moedaBR.format(Math.abs(valor))}`;
}
```

`moeda` passa a ser parâmetro obrigatório — sem default silencioso para USD,
para forçar cada um dos 33 call sites a declarar de onde tira a moeda (da
conta em contexto, ou do ativo em contexto no caso do Backteste). Isso é
proposital: um default silencioso deixaria passar despercebido um lugar que
esqueceram de conectar a moeda certa.

### Call sites por tela

- **Conta** (`conta/page.tsx`, `conta/formulario.tsx`): usa `conta.moeda`.
  Os rótulos hoje fixos "(USD)" em `saldo_inicial`, `meta`, `mlpt`, `mlpd`
  passam a refletir o rádio de moeda selecionado (client-side, sem round-trip).
- **Perfomance** (`perfomance/page.tsx`, `acoes-trade.tsx`,
  `formulario-trade.tsx`): usa `conta.moeda` da conta selecionada no seletor
  do topo.
- **Plano** (`plano/page.tsx`, `plano/editar/formulario.tsx`,
  `imprimir/plano/page.tsx`): usa a moeda da conta cujo MLPT/MLPD estão
  sendo exibidos (mesma conta que já é lida hoje).
- **Calendário e gráficos** (`components/calendario.tsx`,
  `components/graficos.tsx`): recebem a moeda como prop, vinda da conta
  selecionada na Perfomance (esses componentes já são renderizados dentro
  daquele contexto).
- **Backteste** (`backteste/[tempo]/tabela.tsx`): o tooltip de "contratos
  ideais para o MLPT" usa a moeda do **ativo sendo backtestado**
  (`moedaDoAtivo(ativo)`), não a da conta padrão — ver próxima seção.

## Trava ativo × moeda

Dois pontos:

1. **Formulário de trade** (`perfomance/formulario-trade.tsx`): o dropdown
   de ativo mostra só os ativos cuja `moeda` bate com `conta.moeda` da conta
   selecionada. Evita lançar WIN numa conta em dólar (ou vice-versa) e o
   `resultado`/`stop_dolar` saírem calculados num valor que mistura pontos
   de uma moeda com limite de outra.
2. **Tooltip de contratos ideais no Backteste** (`ValorStopDolar` em
   `backteste/[tempo]/tabela.tsx`): usa a moeda do **ativo sendo
   backtestado** (`dadosAtivo.moeda`, já disponível ali), não a moeda da
   conta padrão que fornece o `mlpt` — `mlptDaContaPadrao()` continua
   devolvendo só o número, sem mudança de assinatura. O valor mostrado
   (`stopPorContrato * contratos`) é inteiramente calculado a partir do
   `valor_do_ponto` do ativo, então algebricamente já está na moeda dele,
   independente de qual moeda o MLPT usado no cálculo tinha. Isso deixa
   visível — em vez de esconder atrás de um `$` genérico — a situação
   pré-existente de alguém backtestar um ativo em moeda diferente da conta
   padrão (ex.: conta padrão BRL, backtestando MES): o tooltip mostra a
   moeda do ativo, não bloqueia nada. Não há conceito de "conta
   selecionada" no Backteste, só a conta padrão de fundo para esse cálculo
   auxiliar.

## CLAUDE.md — dois arquivos, ambos precisam mudar

- `aion/CLAUDE.md` (fonte de verdade real): aplicar a mesma adição de WIN
  já feita no `CLAUDE.md` da raiz (enum `ativo`, tabela de ativos com coluna
  Moeda) **mais** a seção de `contas` ganhando o campo `moeda`, e a
  linguagem de "dois usuários" atualizada para "três usuários" (seções 1,
  2, 5.0).
- `CLAUDE.md` da raiz (histórico/duplicata): mesma atualização, para não
  voltar a divergir.

## Fora de escopo

- Conversão automática entre USD e BRL — decisão explícita: não converte.
- Restringir `plano.ativos` por conta — o Plano é um registro por usuário,
  não por conta; continua listando os ativos que aquele usuário opera, sem
  mudança de escopo aqui.
- Suporte a mais de duas moedas — o enum `moeda_conta` fica fechado em
  `USD`/`BRL`; não há necessidade hoje de um terceiro valor.

## Testes

- `lib/metricas.check.ts` (ou onde os testes de métricas já vivem) ganha
  casos para `moeda()` com `BRL` e `USD`.
- Teste manual: cadastrar conta em BRL para o novo usuário, lançar um trade
  em WIN, conferir que Conta/Perfomance/Plano mostram `R$` e que o dropdown
  de ativo no formulário de trade não oferece MES/MYM/MNQ/MGC/MCL/MBT
  quando essa conta está selecionada.
