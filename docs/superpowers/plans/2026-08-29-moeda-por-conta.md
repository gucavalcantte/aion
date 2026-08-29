# WIN + Moeda por Conta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WIN (Mini Índice, B3) as a real tradable asset and let each conta declare its own display currency (USD or BRL), so a third user who only trades WIN sees Real everywhere while the existing two users keep seeing Dollar.

**Architecture:** Two independent currency concepts. `ativos.ts`/the Postgres `ativo` enum carry each asset's *native* currency (fixed, WIN=BRL, the other six=USD). A new `moeda` column on `contas` carries each account's *display* currency (chosen by the user, default USD). `formato.ts`'s `moeda()` formatter stops hardcoding `$` and takes the currency as a required parameter, forcing every one of its ~33 call sites to declare where its currency comes from. The trade form's asset picker is filtered to the selected conta's currency so a user can't log a BRL asset under a USD account or vice versa.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, Supabase/Postgres (manual SQL migrations pasted into the Supabase SQL editor — no CLI/ORM in this repo), no test framework (`npm run check` runs `src/lib/metricas.check.ts`, a plain assertion script).

**Spec:** `docs/superpowers/specs/2026-08-29-moeda-por-conta-design.md`

## Global Constraints

- App não converte entre moedas — cada valor é exibido na moeda que já é sua (do ativo ou da conta), nunca recalculado para outra.
- `moeda()` em `src/lib/formato.ts` não ganha um default silencioso de moeda — o parâmetro é obrigatório em todo call site, de propósito (ver spec).
- Nomes de campos históricos (`stop_dolar`, o texto "USD" em comentários antigos) não são renomeados — só o comportamento de exibição muda.
- `plano.ativos` continua sendo por usuário, não por conta — fora de escopo mexer nisso.
- O enum de moeda fica fechado em `USD`/`BRL` — sem terceiro valor.
- Toda migração SQL é colada manualmente no SQL Editor do Supabase pelo usuário — nenhuma ferramenta deste plano tem acesso ao banco.

---

## Task 1: Migração SQL — WIN e `moeda_conta`

**Files:**
- Create: `supabase/migracoes/0002_win_e_moeda.sql`

**Interfaces:**
- Produces: enum `ativo` ganha o valor `'WIN'`; função `public.valor_do_ponto(ativo)` passa a tratar `'WIN'`; novo enum `moeda_conta` (`'USD' | 'BRL'`); coluna `public.contas.moeda moeda_conta not null default 'USD'`. Todas as tasks seguintes que leem `contas.*` dependem dessa coluna existir.

- [ ] **Step 1: Escrever o arquivo de migração**

`ALTER TYPE ... ADD VALUE` não pode rodar no mesmo bloco de transação que já usa o valor novo — por isso o arquivo é dividido em duas partes com um aviso entre elas.

```sql
-- =============================================================================
-- AION — WIN (Mini Índice) e moeda por conta
--
-- Rodar em DUAS etapas, porque o Postgres não deixa usar um valor de enum
-- recém-criado na mesma transação que o `ALTER TYPE ... ADD VALUE`:
--
--   1. Selecione só o bloco "ETAPA 1" abaixo, cole no SQL Editor do Supabase
--      e rode.
--   2. Depois, selecione o bloco "ETAPA 2" e rode.
--
-- Rodar o arquivo inteiro de uma vez só (como no 0001) falha com o erro
-- "unsafe use of new value of enum type".
-- =============================================================================

-- ETAPA 1 -----------------------------------------------------------------
alter type ativo add value 'WIN';

-- ETAPA 2 -----------------------------------------------------------------
create or replace function public.valor_do_ponto(a ativo)
returns numeric
language sql
immutable
parallel safe
as $$
  select case a
    when 'MES' then 5.0
    when 'MYM' then 0.5
    when 'MNQ' then 2.0
    when 'MGC' then 10.0
    when 'MCL' then 100.0
    when 'MBT' then 0.1
    when 'WIN' then 0.2
  end
$$;

create type moeda_conta as enum ('USD', 'BRL');

alter table public.contas
  add column moeda moeda_conta not null default 'USD';
```

- [ ] **Step 2: Rodar a ETAPA 1 no Supabase**

No painel do Supabase do projeto AION → SQL Editor: cole só o bloco `-- ETAPA 1` (a linha `alter type ativo add value 'WIN';`) e rode.

Esperado: `Success. No rows returned.`

- [ ] **Step 3: Rodar a ETAPA 2 no Supabase**

Cole o restante do arquivo (da linha `create or replace function...` até o fim) e rode.

Esperado: `Success. No rows returned.`

- [ ] **Step 4: Conferir manualmente**

No SQL Editor, rode:

```sql
select public.valor_do_ponto('WIN');
select moeda from public.contas limit 5;
```

Esperado: a primeira consulta devolve `0.2`; a segunda devolve `USD` para todas as contas existentes (o default aplicado retroativamente).

- [ ] **Step 5: Commit**

```bash
git add supabase/migracoes/0002_win_e_moeda.sql
git commit -m "feat(db): add WIN asset and per-account currency column"
```

---

## Task 2: `ativos.ts` — WIN e moeda nativa por ativo

**Files:**
- Modify: `src/lib/ativos.ts`
- Modify: `src/lib/metricas.check.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores (arquivo puro, sem dependência de banco).
- Produces: `export type Moeda = "USD" | "BRL"` (de `src/lib/ativos.ts`); `export function moedaDoAtivo(codigo: Ativo): Moeda`; `ATIVOS` ganha a entrada `WIN` e o campo `moeda` em cada item. Tasks 3+ importam `Moeda` e `moedaDoAtivo` deste arquivo.

- [ ] **Step 1: Escrever as checagens (falham antes da implementação)**

Em `src/lib/metricas.check.ts`, adicionar ao topo do arquivo, na lista de imports existente, os símbolos novos:

```ts
import {
  assertividade,
  drawdownDoPico,
  pisoDeConfianca,
  progressoDaMeta,
  resultadoEmPontos,
  riscoRetornoMedio,
  saldoAtual,
  sequenciaAtual,
  statusDoResultado,
  stopEmDolar,
  tetoDeConfianca,
} from "./metricas";
import { moedaDoAtivo, valorPonto } from "./ativos";
```

E, logo antes da linha `console.log(falhas === 0 ...)`, adicionar:

```ts
// WIN entrou como ativo em BRL — os outros seis continuam em USD
eq("valor do ponto do WIN", valorPonto("WIN"), 0.2);
eq("moeda nativa do WIN", moedaDoAtivo("WIN"), "BRL");
eq("moeda nativa do MES", moedaDoAtivo("MES"), "USD");
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run check`

Expected: falha em `valor do ponto do WIN` e nas duas checagens de `moedaDoAtivo` — `valorPonto("WIN")` e `moedaDoAtivo` não existem/não reconhecem `"WIN"` ainda (erro de tipo/compilação do `tsx`, ou `undefined` nas asserções).

- [ ] **Step 3: Implementar**

Substituir o conteúdo de `src/lib/ativos.ts` (mantendo o comentário de topo):

```ts
/**
 * Constante da aplicação — não é tabela, não é editável pelo usuário.
 * Ver CLAUDE.md, seção 3.2.
 */

export const ATIVOS = [
  { codigo: "MES", nome: "S&P", valorPonto: 5, unidade: "pontos", moeda: "USD" },
  { codigo: "MYM", nome: "Dow", valorPonto: 0.5, unidade: "pontos", moeda: "USD" },
  { codigo: "MNQ", nome: "Nasdaq", valorPonto: 2, unidade: "pontos", moeda: "USD" },
  { codigo: "MGC", nome: "Gold", valorPonto: 10, unidade: "pontos", moeda: "USD" },
  // MCL é pensado em %: 1% = 1,00 de movimento = $100 por contrato.
  { codigo: "MCL", nome: "Oil", valorPonto: 100, unidade: "%", moeda: "USD" },
  { codigo: "MBT", nome: "Bitcoin", valorPonto: 0.1, unidade: "pontos", moeda: "USD" },
  { codigo: "WIN", nome: "Mini Índice", valorPonto: 0.2, unidade: "pontos", moeda: "BRL" },
] as const;

export type Ativo = (typeof ATIVOS)[number]["codigo"];
export type Moeda = (typeof ATIVOS)[number]["moeda"];

const PORCODIGO = new Map(ATIVOS.map((a) => [a.codigo, a]));

export function ativo(codigo: Ativo) {
  const a = PORCODIGO.get(codigo);
  if (!a) throw new Error(`Ativo desconhecido: ${codigo}`);
  return a;
}

export function valorPonto(codigo: Ativo): number {
  return ativo(codigo).valorPonto;
}

/** O rótulo do campo de stop muda conforme o ativo: pontos, dólares ou %. */
export function unidadeDoStop(codigo: Ativo): string {
  return ativo(codigo).unidade;
}

/** WIN é o único ativo em BRL — os outros seis negociam em USD. */
export function moedaDoAtivo(codigo: Ativo): Moeda {
  return ativo(codigo).moeda;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run check`

Expected: todas as linhas `ok`, incluindo as três novas, terminando em `tudo certo`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ativos.ts src/lib/metricas.check.ts
git commit -m "feat: add WIN asset with BRL as its native currency"
```

---

## Task 3: Tipos e `formato.ts` — moeda deixa de ser fixa

**Files:**
- Modify: `src/lib/tipos.ts`
- Modify: `src/lib/formato.ts`
- Modify: `src/lib/metricas.check.ts`

**Interfaces:**
- Consumes: `Moeda` de `src/lib/ativos.ts` (Task 2).
- Produces: `Conta.moeda: Moeda` e `ContaComSaldo.moeda: Moeda`; `moeda(valor, moedaConta, comSinal?)` (assinatura nova, com o 2º parâmetro **obrigatório**); `simboloDaMoeda(moedaConta): string`. Toda task seguinte que chama `moeda(...)` ou lê `conta.moeda` depende deste.

- [ ] **Step 1: Escrever as checagens (falham antes da implementação)**

Em `src/lib/metricas.check.ts`, adicionar ao import existente do `formato`:

```ts
import { moeda } from "./formato";
```

(Se ainda não houver import de `./formato` no arquivo, adicionar essa linha junto dos outros imports.)

E adicionar, junto das checagens de ativos do Task 2:

```ts
// moeda() exige a moeda — símbolo muda, formatação decimal não
eq("moeda em dólar", moeda(1234.5, "USD"), "$1.234,50");
eq("moeda em real", moeda(1234.5, "BRL"), "R$1.234,50");
eq("moeda negativa com sinal", moeda(-50, "USD", true), "-$50,00");
eq("moeda vazia", moeda(null, "USD"), "—");
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run check`

Expected: erro de tipo do TypeScript (`tsx` acusa "Expected 2-3 arguments, but got 1" nas chamadas de `moeda(1234.5)` do próprio `formato.ts`/call sites existentes) ou, se o build ainda aceitar por causa do parâmetro antigo ser opcional, as asserções de símbolo (`R$` vs `$`) falham porque tudo ainda sai com `$`.

- [ ] **Step 3: Atualizar `src/lib/tipos.ts`**

```ts
import type { Ativo, Moeda } from "./ativos";

export type TempoGrafico = "1m" | "2m" | "3m" | "5m" | "15m" | "60m" | "1D";
export type TipoConta = "Remunerada" | "Simulador";
export type TipoLancamento = "Saque" | "Aporte";

export type Conta = {
  id: string;
  created_at: string;
  numero: string;
  tipo_conta: TipoConta;
  moeda: Moeda;
  saldo_inicial: number;
  meta: number | null;
  mlpt: number;
  mlpd: number;
  is_padrao: boolean;
};
```

(O resto do arquivo — `Lancamento`, `ContaComSaldo`, `Estudo` — fica igual; `ContaComSaldo` já herda `moeda` de `Conta` via `Conta & {...}`.)

- [ ] **Step 4: Atualizar `src/lib/formato.ts`**

```ts
import type { Moeda } from "./ativos";

/** Nulo vira travessão. Nunca NaN, nunca 0% onde não há dado. */
export const VAZIO = "—";

const moedaBR = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inteiroBR = new Intl.NumberFormat("pt-BR");

const SIMBOLO: Record<Moeda, string> = { USD: "$", BRL: "R$" };

/** Símbolo de moeda isolado — usado onde o valor já vem formatado por fora (eixos de gráfico). */
export function simboloDaMoeda(moedaConta: Moeda): string {
  return SIMBOLO[moedaConta];
}

export function moeda(valor: number | null | undefined, moedaConta: Moeda, comSinal = false) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return VAZIO;
  const sinal = comSinal && valor > 0 ? "+" : valor < 0 ? "-" : "";
  return `${sinal}${SIMBOLO[moedaConta]}${moedaBR.format(Math.abs(valor))}`;
}

export function inteiro(valor: number | null | undefined) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return VAZIO;
  return inteiroBR.format(valor);
}

export function percentual(valor: number | null | undefined, casas = 1) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return VAZIO;
  return `${valor.toFixed(casas).replace(".", ",")}%`;
}

/** Risco/retorno sempre com sinal: o sinal é a informação. */
export function emR(valor: number | null | undefined) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return VAZIO;
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toFixed(2).replace(".", ",")}R`;
}

export function data(iso: string | null | undefined) {
  if (!iso) return VAZIO;
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function hora(valor: string | null | undefined) {
  if (!valor) return VAZIO;
  return valor.slice(0, 5);
}
```

Neste ponto o build do TypeScript vai acusar erro em todos os ~33 call sites de `moeda(...)` espalhados pelo app — isso é esperado, e é resolvido tarefa por tarefa (4 a 9). Este task só estabelece a nova assinatura.

- [ ] **Step 5: Rodar `npm run check` e confirmar que as 4 novas checagens passam**

Run: `npm run check`

Expected: as 4 linhas de moeda saem `ok`. (O comando `tsx` roda só o arquivo `metricas.check.ts` e o que ele importa — `formato.ts` e `ativos.ts` — então não é afetado pelos call sites quebrados no resto do app; esses só aparecem no `npm run build`, que só vai passar limpo depois do Task 9.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/tipos.ts src/lib/formato.ts src/lib/metricas.check.ts
git commit -m "feat: require currency explicitly in moeda() formatter"
```

---

## Task 4: Tela Conta — campo de moeda no cadastro

**Files:**
- Modify: `src/app/(app)/conta/formulario.tsx`
- Modify: `src/app/(app)/conta/acoes.ts`
- Modify: `src/app/(app)/conta/page.tsx`

**Interfaces:**
- Consumes: `Moeda` de `@/lib/ativos`; `moeda()` de `@/lib/formato` (Task 3).
- Produces: nada que outra task consuma — esta tela é folha (a leitura de `conta.moeda` em outras telas vem de `lib/dados/contas.ts`, que já repassa a coluna sem mudança de código).

- [ ] **Step 1: Adicionar o campo de moeda no formulário**

Em `src/app/(app)/conta/formulario.tsx`, trocar o import de `react` para incluir `useState`:

```tsx
import { useActionState, useState } from "react";
```

(era `import { useActionState } from "react";`; o import de `import type { Conta } from "@/lib/tipos";` fica igual.)

Dentro de `FormularioConta`, logo após `const editando = Boolean(conta);`:

```tsx
  const [moedaSelecionada, setMoedaSelecionada] = useState<"USD" | "BRL">(conta?.moeda ?? "USD");
```

Adicionar um novo `fieldset` de moeda logo depois do `fieldset` de "Tipo de conta" (antes do campo "Saldo inicial"):

```tsx
        <fieldset>
          <legend className={rotulo}>Moeda da conta</legend>
          <div className="flex gap-1 rounded-[9px] border border-line-strong bg-input p-[3px]">
            {(["USD", "BRL"] as const).map((m) => (
              <label key={m} className="flex-1">
                <input
                  type="radio"
                  name="moeda"
                  value={m}
                  checked={moedaSelecionada === m}
                  onChange={() => setMoedaSelecionada(m)}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-md py-[7px] text-center text-[14.5px] font-medium text-ink-3 peer-checked:bg-raised peer-checked:text-ink">
                  {m === "USD" ? "Dólar" : "Real"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
```

Trocar os três rótulos fixos de "(USD)" pelo valor reativo:

```tsx
          <label className={rotulo} htmlFor="saldo_inicial">Saldo inicial ({moedaSelecionada})</label>
```
```tsx
          <label className={`${rotulo} !text-accent-soft`} htmlFor="meta">Meta para saque ({moedaSelecionada})</label>
```
```tsx
            <label className={rotulo} htmlFor="mlpt">MLPT ({moedaSelecionada})</label>
```
```tsx
            <label className={rotulo} htmlFor="mlpd">MLPD ({moedaSelecionada})</label>
```

- [ ] **Step 2: Validar e persistir no server action**

Em `src/app/(app)/conta/acoes.ts`, dentro de `salvarConta`, logo após a linha `const tipo = String(dados.get("tipo_conta") ?? "");`:

```ts
  const moedaConta = String(dados.get("moeda") ?? "");
```

Logo após a validação `if (tipo !== "Remunerada" && tipo !== "Simulador") return { erro: "Escolha o tipo da conta." };`:

```ts
  if (moedaConta !== "USD" && moedaConta !== "BRL") return { erro: "Escolha a moeda da conta." };
```

E incluir no objeto `campos`:

```ts
  const campos = {
    numero: numeroConta,
    tipo_conta: tipo,
    moeda: moedaConta,
    saldo_inicial: saldoInicial,
    meta,
    mlpt,
    mlpd,
    is_padrao: isPadrao,
  };
```

- [ ] **Step 3: Exibir a moeda nos valores já existentes da tela**

Em `src/app/(app)/conta/page.tsx`, os cinco `moeda(...)` da função `CartaoConta` e o `moeda(...)` do progresso ganham o segundo argumento:

```tsx
        <Metrica titulo="Saldo inicial" valor={moeda(conta.saldo_inicial, conta.moeda)} />
        <Metrica titulo="Saldo atual" valor={moeda(conta.saldo_atual, conta.moeda)} cor={corSaldo} destaque />
        <Metrica titulo="Meta para saque" valor={conta.meta === null ? VAZIO : moeda(conta.meta, conta.moeda)} />
        <Metrica titulo="Risco por trade" valor={moeda(conta.mlpt, conta.moeda)} />
        <Metrica titulo="Perda máx. do dia" valor={moeda(conta.mlpd, conta.moeda)} />
```

```tsx
                {moeda(conta.progresso.lucro, conta.moeda, true)}
```

```tsx
              <span className="num ml-1.5 text-[13px] text-ink-4">de {moeda(conta.meta, conta.moeda)}</span>
```

```tsx
            <span className="num text-ink-3">faltam {moeda(conta.progresso.falta, conta.moeda)}</span>
```

Opcional (recomendado): mostrar a moeda como um selo ao lado do tipo da conta, junto de `conta.tipo_conta`, para não depender só do símbolo dentro dos números — adicionar logo após o selo de tipo:

```tsx
          <span className="inline-flex h-[23px] items-center rounded-md bg-raised px-[9px] text-[12.5px] font-semibold text-ink-3">
            {conta.moeda}
          </span>
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run lint`

Expected: sem erros novos no arquivo `conta/formulario.tsx`, `conta/acoes.ts`, `conta/page.tsx` (o resto do app ainda vai ter erros de `moeda()` — normal até o Task 9).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/conta/formulario.tsx src/app/\(app\)/conta/acoes.ts src/app/\(app\)/conta/page.tsx
git commit -m "feat: add currency field to account form and screen"
```

---

## Task 5: Tela Perfomance — cards, tabela e lançamentos

**Files:**
- Modify: `src/app/(app)/perfomance/page.tsx`
- Modify: `src/app/(app)/perfomance/acoes-trade.tsx`
- Modify: `src/app/(app)/perfomance/formulario-lancamento.tsx`

**Interfaces:**
- Consumes: `conta.moeda` (`Conta`/`ContaComSaldo`, Task 3); `moeda()` nova assinatura (Task 3).
- Produces: `AcoesDoTrade` e `FormularioLancamento` passam a exigir a prop `moedaConta: Moeda` — a Task 6 (`FormularioTrade`) e a Task 7 (gráficos/calendário) recebem essa mesma prop pelo mesmo caminho, todos alimentados por `conta.moeda` a partir de `perfomance/page.tsx`.

- [ ] **Step 1: `perfomance/page.tsx` — os 12 pontos de `moeda(...)`**

Todas as trocas abaixo são no mesmo arquivo, cada `moeda(...)` ganhando `conta.moeda` como argumento:

```tsx
            {moeda(resumo.saldo, conta.moeda)}
```
```tsx
              {moeda(resumo.noMes, conta.moeda, true)}
```
```tsx
                  {moeda(resumo.meta.falta, conta.moeda)}
```
```tsx
                <span className="num">{moeda(resumo.meta.lucro, conta.moeda, true)} de {moeda(conta.meta, conta.moeda)}</span>
```
```tsx
            {resumo.drawdown.atual > 0 ? `-${moeda(resumo.drawdown.atual, conta.moeda)}` : moeda(0, conta.moeda)}
```
```tsx
            máximo já visto: <span className="num text-ink-3">{moeda(resumo.drawdown.maximo, conta.moeda)}</span>
```
```tsx
            <span className="num text-[22px] font-semibold tracking-[-0.03em] text-gain">{moeda(resumo.mediaGanho, conta.moeda, true)}</span>
```
```tsx
            <span className="num text-[22px] font-semibold tracking-[-0.03em] text-loss">{moeda(resumo.mediaPerda, conta.moeda)}</span>
```
```tsx
            MLPT {moeda(conta.mlpt, conta.moeda)}
```
```tsx
                      <td className={`${td} num text-right text-ink-3`}>{moeda(t.stop_dolar, conta.moeda)}</td>
```
```tsx
                        {moeda(t.resultado, conta.moeda, true)}
```
```tsx
                  {l.tipo === "Aporte" ? moeda(l.valor, conta.moeda, true) : `-${moeda(l.valor, conta.moeda)}`}
```

- [ ] **Step 2: `perfomance/page.tsx` — repassar a moeda para os componentes filhos**

Trocar a chamada de `FormularioTrade` (dentro do `<header>`):

```tsx
          <FormularioTrade contaId={conta.id} setups={setups} moedaConta={conta.moeda} />
```

Trocar a chamada de `CalendarioDeConsistencia`:

```tsx
          <CalendarioDeConsistencia mes={mes} porDia={porDia} moedaConta={conta.moeda} />
```

Trocar a chamada de `CurvaDeCapital`:

```tsx
            <CurvaDeCapital pontos={curva.pontos} marcadores={curva.marcadores} meta={conta.meta} moedaConta={conta.moeda} />
```

Trocar a chamada de `ResultadoPorOperacao`:

```tsx
          <ResultadoPorOperacao
            trades={[...listagem].reverse().map((t) => ({ resultado: t.resultado, data: fData(t.data) }))}
            mlpt={conta.mlpt}
            moedaConta={conta.moeda}
            largura={1120}
          />
```

Trocar a chamada de `AcoesDoTrade` (dentro do `<tbody>` da tabela):

```tsx
                        <AcoesDoTrade
                          trade={{ ...t, imagem: null }}
                          contaId={conta.id}
                          setups={setups}
                          moedaConta={conta.moeda}
                        />
```

- [ ] **Step 3: `acoes-trade.tsx` — receber e repassar a moeda**

```tsx
export function AcoesDoTrade({
  trade,
  contaId,
  setups,
  moedaConta,
}: {
  trade: TradeParaEdicao;
  contaId: string;
  setups: { id: string; nome: string }[];
  moedaConta: Moeda;
}) {
```

Adicionar o import do tipo no topo do arquivo:

```tsx
import type { Moeda } from "@/lib/ativos";
```

Trocar a chamada de `moeda` na descrição do `BotaoRemover`:

```tsx
        descricao={`${trade.ativo} · ${fData(trade.data)} · ${moeda(trade.resultado, moedaConta, true)}. O saldo da conta e todas as estatísticas mudam junto.`}
```

Repassar a moeda para o `FormularioTrade` de edição:

```tsx
      {editando && (
        <FormularioTrade
          contaId={contaId}
          setups={setups}
          trade={trade}
          moedaConta={moedaConta}
          aoFechar={() => setEditando(false)}
        />
      )}
```

- [ ] **Step 4: `formulario-lancamento.tsx` — rótulo dinâmico**

```tsx
import type { Moeda } from "@/lib/ativos";

export function FormularioLancamento({ contaId, moedaConta }: { contaId: string; moedaConta: Moeda }) {
```

```tsx
                <span className={rotulo}>Valor ({moedaConta})</span>
```

E em `perfomance/page.tsx`, repassar a moeda na chamada do formulário de lançamento:

```tsx
          <FormularioLancamento contaId={conta.id} moedaConta={conta.moeda} />
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/perfomance/page.tsx src/app/\(app\)/perfomance/acoes-trade.tsx src/app/\(app\)/perfomance/formulario-lancamento.tsx
git commit -m "feat: thread account currency through the Perfomance screen"
```

(Este task deixa `formulario-trade.tsx`, `calendario.tsx` e `graficos.tsx` referenciando uma prop `moedaConta` que ainda não existe nesses componentes — isso é resolvido nos Tasks 6 e 7, então o `npm run build` só fecha limpo depois deles.)

---

## Task 6: Formulário de trade — filtro de ativo por moeda

**Files:**
- Modify: `src/app/(app)/perfomance/formulario-trade.tsx`

**Interfaces:**
- Consumes: `moedaConta: Moeda` vindo de `acoes-trade.tsx` e `perfomance/page.tsx` (Task 5); `ATIVOS`/`Moeda` de `@/lib/ativos`.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Filtrar a lista de ativos pela moeda da conta**

Import do tipo, junto do import existente de `ativos`:

```tsx
import { ATIVOS, type Ativo, type Moeda } from "@/lib/ativos";
```

Adicionar `moedaConta` à assinatura do componente:

```tsx
export function FormularioTrade({
  contaId,
  setups,
  moedaConta,
  trade,
  aoFechar,
}: {
  contaId: string;
  setups: { id: string; nome: string }[];
  moedaConta: Moeda;
  /** Presente = corrigindo um trade já salvo. */
  trade?: TradeParaEdicao;
  aoFechar?: () => void;
}) {
```

Logo abaixo de `const editando = Boolean(trade);`, calcular a lista filtrada e usá-la como base do estado inicial (substitui o `"MNQ"` fixo, que deixaria de existir na lista quando a conta é BRL):

```tsx
  const editando = Boolean(trade);
  const ativosPermitidos = ATIVOS.filter((a) => a.moeda === moedaConta);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, acao, enviando] = useActionState(salvarTrade, INICIAL);

  const [ativo, setAtivo] = useState<Ativo>(trade?.ativo ?? ativosPermitidos[0].codigo);
```

Trocar o `.map` que desenha os botões de rádio de ativo (dentro do bloco `<span className={rotulo}>Ativo</span>`):

```tsx
                <div className="flex flex-wrap gap-[7px]">
                  {ativosPermitidos.map((a) => (
                    <label key={a.codigo}>
```

(o resto do `<label>` continua igual — só a fonte da lista muda de `ATIVOS` para `ativosPermitidos`.)

- [ ] **Step 2: Rótulo e valor calculado na moeda certa**

```tsx
                <label>
                  <span className={rotulo}>Resultado ({moedaConta})</span>
```

```tsx
                    <span className="num">{stopDolar === null ? VAZIO : moeda(stopDolar, moedaConta)}</span>
```

- [ ] **Step 3: Rodar lint e build**

Run: `npm run lint && npm run build`

Expected: sem erros em `formulario-trade.tsx`. Erros restantes (se houver) devem estar só em `calendario.tsx`/`graficos.tsx`, resolvidos no próximo task.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/perfomance/formulario-trade.tsx
git commit -m "feat: filter asset picker by account currency in trade form"
```

---

## Task 7: Calendário e gráficos — símbolo de moeda dinâmico

**Files:**
- Modify: `src/components/calendario.tsx`
- Modify: `src/components/graficos.tsx`

**Interfaces:**
- Consumes: `moedaConta: Moeda` vindo de `perfomance/page.tsx` (Task 5); `moeda()`/`simboloDaMoeda()` de `@/lib/formato` (Task 3).
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: `calendario.tsx`**

```tsx
import { moeda, simboloDaMoeda } from "@/lib/formato";
import type { Moeda } from "@/lib/ativos";

export function CalendarioDeConsistencia({
  mes,
  porDia,
  moedaConta,
}: {
  /** "2026-08" */
  mes: string;
  porDia: Map<string, { resultado: number; trades: number }>;
  moedaConta: Moeda;
}) {
```

```tsx
                  {registro.resultado === 0 ? `${simboloDaMoeda(moedaConta)}0` : moeda(registro.resultado, moedaConta, true).replace(",00", "")}
```

```tsx
              <span className={`num ${total >= 0 ? "text-gain" : "text-loss"}`}>{moeda(total, moedaConta, true)}</span>
```

- [ ] **Step 2: `graficos.tsx` — `curto()` recebe o símbolo**

```tsx
import type { MarcaDeCaixa, PontoDaCurva } from "@/lib/dados/trades";
import { moeda } from "@/lib/formato";
import type { Moeda } from "@/lib/ativos";
```

```tsx
function curto(v: number, simbolo: string) {
  const abs = Math.abs(v);
  if (abs >= 10000) return `${v < 0 ? "-" : ""}${simbolo}${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${v < 0 ? "-" : ""}${simbolo}${(abs / 1000).toFixed(1).replace(".", ",")}k`;
  return `${v < 0 ? "-" : ""}${simbolo}${Math.round(abs)}`;
}
```

Em `CurvaDeCapital`, adicionar a prop e usar nas duas chamadas de `curto`/`moeda`:

```tsx
export function CurvaDeCapital({
  pontos,
  marcadores,
  meta,
  moedaConta,
  largura = 560,
}: {
  pontos: PontoDaCurva[];
  marcadores: MarcaDeCaixa[];
  /** Meta em lucro acumulado, não em saldo. */
  meta: number | null;
  moedaConta: Moeda;
  largura?: number;
}) {
```

```tsx
import { moeda, simboloDaMoeda } from "@/lib/formato";
```

```tsx
  const simbolo = simboloDaMoeda(moedaConta);
```
(adicionar essa linha logo após o `if (pontos.length < 2) return ...;`, antes de `const valores = ...`)

```tsx
            <text x={ESQ - 8} y={y(v) + 4} textAnchor="end" fontSize="11.5" fill="var(--ink-4)" className="num">
              {curto(v, simbolo)}
            </text>
```

```tsx
            <title>{`#${p.i} · ${p.data} · ${moeda(p.resultado, moedaConta, true)} · acumulado ${moeda(p.lucro, moedaConta, true)}`}</title>
```

```tsx
              <title>{`${m.tipo} de ${moeda(m.valor, moedaConta)} em ${m.data}`}</title>
```

Em `ResultadoPorOperacao`, o mesmo padrão:

```tsx
export function ResultadoPorOperacao({
  trades,
  mlpt,
  moedaConta,
  largura = 1100,
}: {
  trades: { resultado: number; data: string }[];
  mlpt: number;
  moedaConta: Moeda;
  largura?: number;
}) {
  if (trades.length === 0) return <Vazio texto="Cada barra é um trade. Registre o primeiro." />;

  const simbolo = simboloDaMoeda(moedaConta);
```

```tsx
        itens={[
          { cor: "var(--gain)", texto: "Gain" },
          { cor: "var(--loss)", texto: "Loss" },
          { cor: "var(--ref)", texto: `Limite MLPT ${moeda(mlpt, moedaConta)}`, tracejado: true },
        ]}
```

```tsx
            <text x={ESQ - 8} y={y(v) + 4} textAnchor="end" fontSize="11.5" fill="var(--ink-4)" className="num">
              {curto(v, simbolo)}
            </text>
```

```tsx
              <title>{`#${i + 1} · ${t.data} · ${moeda(t.resultado, moedaConta, true)}`}</title>
```

- [ ] **Step 3: Rodar lint e build**

Run: `npm run lint && npm run build`

Expected: sem erros em `calendario.tsx` ou `graficos.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/calendario.tsx src/components/graficos.tsx
git commit -m "feat: make chart and calendar currency symbols dynamic"
```

---

## Task 8: Plano — MLPT/MLPD na moeda da conta

**Files:**
- Modify: `src/app/(app)/plano/page.tsx`
- Modify: `src/app/(app)/plano/editar/formulario.tsx`
- Modify: `src/app/imprimir/plano/page.tsx`

**Interfaces:**
- Consumes: `conta.moeda` de `lib/dados/plano.ts` → `carregarPlano()` (o objeto `conta` já é um `Conta` completo, com `moeda`, assim que o Task 3 atualiza o tipo — nenhuma mudança em `lib/dados/plano.ts` é necessária).
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: `plano/page.tsx` — componente `Limite`**

```tsx
import type { Moeda } from "@/lib/ativos";
```

```tsx
function Limite({
  titulo,
  descricao,
  valor,
  moedaConta,
}: {
  titulo: string;
  descricao: string;
  valor?: number;
  moedaConta: Moeda;
}) {
  return (
    <span className="flex items-baseline justify-between">
      <span>
        <span className="num block text-[13px] text-ink-3">{titulo}</span>
        <span className="mt-0.5 block text-[11.5px] text-ink-4">{descricao}</span>
      </span>
      <span className="num text-[21px] font-semibold text-loss">
        {valor === undefined ? VAZIO : moeda(valor, moedaConta).replace(",00", "")}
      </span>
    </span>
  );
}
```

E os dois call sites, dentro do bloco de Gerenciamento:

```tsx
                <Limite titulo="MLPT" descricao="perda máxima por trade" valor={conta?.mlpt} moedaConta={conta?.moeda ?? "USD"} />
                <span className="h-px bg-line" />
                <Limite titulo="MLPD" descricao="perda máxima do dia" valor={conta?.mlpd} moedaConta={conta?.moeda ?? "USD"} />
```

- [ ] **Step 2: `plano/editar/formulario.tsx`**

Ampliar o tipo inline do prop `conta`:

```tsx
export function FormularioPlano({
  plano,
  conta,
}: {
  plano: Plano | null;
  conta: { id: string; numero: string; moeda: "USD" | "BRL"; mlpt: number; mlpd: number } | null;
}) {
```

```tsx
                <span className="num text-[20px] font-semibold text-loss">
                  {conta ? moeda(conta.mlpt, conta.moeda).replace(",00", "") : "—"}
                </span>
```

```tsx
                <span className="num text-[20px] font-semibold text-loss">
                  {conta ? moeda(conta.mlpd, conta.moeda).replace(",00", "") : "—"}
                </span>
```

- [ ] **Step 3: `imprimir/plano/page.tsx`**

```tsx
import type { Moeda } from "@/lib/ativos";
```

```tsx
            <div className="flex gap-2">
              <Limite titulo="MLPT · por trade" valor={conta?.mlpt} moedaConta={conta?.moeda ?? "USD"} />
              <Limite titulo="MLPD · por dia" valor={conta?.mlpd} moedaConta={conta?.moeda ?? "USD"} />
            </div>
```

```tsx
function Limite({ titulo, valor, moedaConta }: { titulo: string; valor?: number; moedaConta: Moeda }) {
  return (
    <span className="flex-1 rounded-[4px] border-[0.5px] border-[#c9c8c0] px-[9px] py-[7px]">
      <span className="num block text-[7.6px] text-[#6b6b63]">{titulo}</span>
      <span className="num mt-0.5 block text-[16px] font-semibold text-[#b3243c]">
        {valor === undefined ? "—" : moeda(valor, moedaConta).replace(",00", "")}
      </span>
    </span>
  );
}
```

- [ ] **Step 4: Rodar lint e build**

Run: `npm run lint && npm run build`

Expected: sem erros nos três arquivos do Plano.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/plano/page.tsx src/app/\(app\)/plano/editar/formulario.tsx src/app/imprimir/plano/page.tsx
git commit -m "feat: show MLPT/MLPD in the account's currency across Plano"
```

---

## Task 9: Backteste — tooltip de contratos ideais na moeda do ativo

**Files:**
- Modify: `src/app/(app)/backteste/[tempo]/tabela.tsx`

**Interfaces:**
- Consumes: `dadosAtivo.moeda` — já disponível no escopo de `ValorStopDolar` via `ATIVOS.find(...)` (Task 2), sem precisar de nova prop.

Nota de design: o Backteste não tem conceito de "conta selecionada" — o `mlpt` que esse tooltip usa vem da conta padrão do usuário (`mlptDaContaPadrao()`), só para sugerir quantos contratos cabem no risco aceito. O valor mostrado (`stopPorContrato * contratos`) é inteiramente calculado a partir do `valorPonto` do ativo sendo backtestado — então a moeda certa para exibi-lo é a do **ativo**, não a da conta padrão. Isso deixa visível, em vez de escondida, a situação (hoje já existente, fora de escopo consertar aqui) de alguém backtestar um ativo em moeda diferente da conta padrão.

- [ ] **Step 1: Trocar o símbolo fixo pela moeda do ativo**

```tsx
        {contratos >= 1 ? (
          <span className="num mt-1 flex items-center justify-between gap-3 whitespace-nowrap text-[12.5px]">
            <span className="text-ink-4">{contratos} {contratos === 1 ? "contrato" : "contratos"}</span>
            <span className="ml-3 font-semibold text-ink">{moeda(stopPorContrato * contratos, dadosAtivo.moeda)}</span>
          </span>
        ) : (
```

- [ ] **Step 2: Rodar lint e build**

Run: `npm run lint && npm run build`

Expected: build limpo — este é o último arquivo com uma chamada de `moeda()` pendente, então o app inteiro deve compilar sem erros de tipo agora.

- [ ] **Step 3: Rodar a checagem completa**

Run: `npm run check`

Expected: `tudo certo` (todas as asserções de `metricas.check.ts`, incluindo as dos Tasks 2 e 3).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/backteste/\[tempo\]/tabela.tsx
git commit -m "feat: show backtest contract-sizing tooltip in the asset's own currency"
```

---

## Task 10: CLAUDE.md — WIN, moeda por conta e o terceiro usuário

**Files:**
- Modify: `CLAUDE.md` (na raiz deste repo `aion` — é o arquivo que o código referencia, ex. o comentário de topo de `src/lib/ativos.ts`)
- Modify: `../CLAUDE.md` (um nível acima da raiz do repo `aion`, fora de qualquer controle de versão — é a cópia antiga/histórica do mesmo documento; edita-se para não voltar a divergir, mas não entra em nenhum commit)

**Interfaces:** nenhuma — documentação.

Os Steps 1 a 4 abaixo se aplicam **aos dois arquivos**, com o texto idêntico — são a mesma edição feita duas vezes, uma por arquivo. O Step 5 só commita o de dentro do repo.

- [ ] **Step 1: Atualizar a linguagem de "dois usuários" para "três usuários"**

Em ambos os arquivos, seção 1 (Objetivo):

```markdown
**Três usuários** (o dono, a esposa e um convidado em teste), uso pessoal, **desktop apenas**.

**Os dados são totalmente separados entre os três.** Setups, contas, backtestes e
trades pertencem a um `user_id` e nunca aparecem para os outros. Nada é
compartilhado — nem os setups. Toda consulta filtra por `user_id`.
```

Na seção 2 (Stack), no parágrafo "O que mudou":

```markdown
  **O que mudou:** com três usuários no mesmo banco, a separação entre os dados
  deixou de depender só do servidor e passou a depender de o código lembrar de
  filtrar por `user_id` em **toda** consulta. Um `select` sem filtro e um usuário vê
  os dados de outro. Ligar RLS custa ~8 policies feitas uma vez e transfere essa
  garantia para o banco. **Perguntar ao usuário antes de começar a Fase 1.**
```

Na seção 5.0 (Login):

```markdown
**Não existe "criar conta".** São três usuários e as contas são criadas manualmente
no painel do Supabase. O rodapé diz isso explicitamente. Autenticação via Supabase
Auth (e-mail + senha). Logout volta para esta tela.
```

- [ ] **Step 2: Aplicar a mudança de WIN e moeda que já está no `CLAUDE.md` da raiz**

O `CLAUDE.md` da raiz já recebeu esta edição numa sessão anterior; `aion/CLAUDE.md` ainda não. Na seção 3.1 (Enums), trocar:

```markdown
| `ativo` | MES, MYM, MNQ, MGC, MCL, MBT |
```
por
```markdown
| `ativo` | MES, MYM, MNQ, MGC, MCL, MBT, WIN |
```

Na seção 3.2, substituir a tabela e o parágrafo seguinte por:

```markdown
### 3.2 Tabela de ativos (constante da aplicação, não editável pelo usuário)

| Código | Nome | Valor do ponto (na moeda do ativo) | Moeda | Rótulo da unidade |
|---|---|---|---|---|
| MES | S&P | 5,00 | USD | pontos |
| MYM | Dow | 0,50 | USD | pontos |
| MNQ | Nasdaq | 2,00 | USD | pontos |
| MGC | Gold | 10,00 | USD | dólares |
| MCL | Oil | 100,00 | USD | **%** |
| MBT | Bitcoin | 0,10 | USD | dólares |
| WIN | Mini Índice | 0,20 | BRL | pontos |

O rótulo da unidade muda o label do campo de stop conforme o ativo escolhido.
MCL é pensado em % pelo usuário: 1% = 1,00 de movimento = $100 por contrato.

**Moeda por ativo, sem conversão.** Os campos derivados de `valor_ponto`
(`stop_dolar` em `trades`, MLPT/MLPD na conta, etc.) herdam a moeda do próprio
ativo — WIN produz valores em R$, os demais em US$. O app não converte entre
moedas; o nome dos campos (`stop_dolar`, "em USD") é histórico de quando só
havia ativos em dólar e deve ser lido como "na moeda do ativo/conta", não
literalmente USD.
```

- [ ] **Step 3: Documentar o campo `moeda` da conta**

Na seção 4, dentro do bloco `### \`contas\``, adicionar o campo logo abaixo de `tipo_conta`:

```markdown
- `tipo_conta` (enum)
- `moeda` (enum `USD` | `BRL`) — moeda de exibição da conta. Não converte:
  uma conta em BRL deveria operar só ativos nativos em BRL (hoje, só WIN).
  Default `USD` para não quebrar contas já cadastradas.
- `saldo_inicial` (numeric) — **saldo atual é sempre calculado**, nunca digitado
```

- [ ] **Step 4: Atualizar a seção 5.1 (Conta)**

```markdown
### 5.1 Conta

CRUD simples: número, tipo, moeda, saldo inicial, MLPT, marcar como padrão.
Ações: editar, remover. Sem filtros.
```

- [ ] **Step 5: Commit**

Só o arquivo dentro do repo `aion` entra em commit — o `../CLAUDE.md` fica fora de qualquer repositório git deste plano, mas já deve estar editado com o mesmo conteúdo ao final dos Steps 1 a 4.

```bash
git add CLAUDE.md
git commit -m "docs: document WIN, per-account currency and the third user"
```

---

## Task 11: Smoke test manual

**Files:** nenhum (validação end-to-end).

- [ ] **Step 1: Rodar o app localmente**

Run: `npm run dev`

- [ ] **Step 2: Criar uma conta em BRL**

Em `/conta`, criar uma conta nova com moeda "Real", MLPT/MLPD/saldo quaisquer.

Expected: os rótulos dos campos mudam para "(BRL)" ao clicar no rádio de moeda, antes mesmo de salvar. Depois de salvo, o cartão da conta mostra os valores com `R$`.

- [ ] **Step 3: Lançar um trade WIN nessa conta**

Em `/perfomance`, selecionar a conta BRL recém-criada, abrir "Novo trade".

Expected: o seletor de ativo mostra só `WIN` (os outros seis não aparecem). Preencher stop e resultado — o campo calculado "Stop inicial" e o rótulo "Resultado" aparecem em `R$`.

- [ ] **Step 4: Trocar para uma conta em USD e repetir**

Selecionar uma conta antiga (USD) no seletor do topo da Perfomance, abrir "Novo trade".

Expected: o seletor de ativo mostra os seis ativos antigos (sem WIN); todos os valores da tela (cards, gráficos, calendário, tabela) aparecem em `$`.

- [ ] **Step 5: Conferir o Plano**

Em `/plano`, com a conta BRL selecionada (`/plano?conta=<id>`), conferir que MLPT/MLPD aparecem em `R$`. Com uma conta USD, em `$`.

- [ ] **Step 6: Conferir o Backteste**

Em `/backteste`, abrir um tempo gráfico, começar uma linha nova com ativo `WIN` e um valor de stop — passar o mouse sobre o ícone `$` ao lado do stop. Se a conta padrão do usuário logado for BRL, o tooltip mostra `R$`; se for USD e o ativo backtestado for WIN, o tooltip mostra `R$` mesmo assim (moeda do ativo, não da conta padrão) — comportamento esperado, documentado no Task 9.

- [ ] **Step 7: Reportar o resultado**

Se algum passo não bater com o esperado, anotar exatamente qual tela e qual valor, para virar um fix pontual — não um novo ciclo de brainstorming.

---

## Ordem de execução

Tasks 1→3 são sequenciais e bloqueantes (schema e tipos antes de qualquer UI). Tasks 4, 8, 9 e 10 são independentes entre si e podem rodar em paralelo depois do Task 3. Task 5 depende só do Task 3, mas Task 6 depende do Task 5 (a prop `moedaConta` chega em `FormularioTrade` por dentro de `acoes-trade.tsx`/`perfomance/page.tsx`), e Task 7 depende do Task 5 pelo mesmo motivo (as chamadas de `CalendarioDeConsistencia`/`CurvaDeCapital`/`ResultadoPorOperacao` em `perfomance/page.tsx`). Task 11 é sempre o último.
