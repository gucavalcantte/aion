# Valor do Ponto por Corretora Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o AION calcular `stop_dolar`, `resultado_pontos` e o R:R sugerido corretamente para as duas corretoras que os usuários realmente usam — a esposa na Ylos, o dono na Zero Markets — em vez da tabela única de hoje, que só está certa para a Ylos.

**Architecture:** `corretora` vira uma coluna em `contas`, com o valor default `Ylos` (preserva os trades já registrados, todos da Ylos). O valor do ponto e o rótulo da unidade, hoje uma lista fixa por ativo em `src/lib/ativos.ts`, viram uma "ficha" indexada por `(corretora, ativo)` — um ativo ausente da ficha de uma corretora (hoje só o WIN na Zero Markets) simplesmente não é oferecido no seletor. `trades.contratos` deixa de ser `integer` (a Zero Markets opera lote fracionado, ex. 0,10). As colunas geradas `stop_dolar`/`resultado_pontos` não podem ler `contas` diretamente (coluna gerada não lê outra tabela), então `trades` ganha sua própria coluna `corretora`, preenchida por trigger a partir da conta no momento do insert.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, Supabase/Postgres (migrações SQL manuais coladas no SQL Editor do Supabase — sem CLI/ORM neste repo), sem framework de teste (`npm run check` roda `src/lib/metricas.check.ts`, um script de asserção simples).

**Spec:** `docs/superpowers/specs/2026-08-31-valor-do-ponto-por-corretora-design.md`

## Global Constraints

- App não converte entre corretoras nem entre moedas — cada valor é calculado com a ficha (`valorPonto`, `unidade`) da corretora da própria conta/trade.
- Ativo ausente da ficha de uma corretora (hoje só WIN na Zero Markets) não aparece no seletor — nenhum dado é inventado para preencher a lacuna.
- MCL na Zero Markets é medido em **pontos** (US$ 10 por ponto, fixo), não em % — decisão explícita para não depender do preço do WTI (ver spec, "O caso do MCL").
- O rótulo da unidade de MGC e MBT é **"dólares"** nas duas corretoras — corrige uma divergência pré-existente entre `CLAUDE.md` §3.2 e `ativos.ts` (ambos diziam "pontos" no código; o `CLAUDE.md` já dizia "dólares").
- Todos os trades registrados até hoje são da Ylos — o default `corretora = 'Ylos'` já é o valor correto para eles; não há backfill de dado divergente.
- Toda migração SQL é colada manualmente no SQL Editor do Supabase pelo usuário — nenhuma ferramenta deste plano tem acesso ao banco.
- `stop_dolar` e `resultado_pontos` continuam sendo colunas `GENERATED ALWAYS ... STORED` — nenhum campo derivável passa a ser calculado só no app (ver `CLAUDE.md` §6: "Nenhum número derivável é digitado duas vezes").

---

## Task 1: Migração SQL — `corretora`

**Files:**
- Create: `supabase/migracoes/0003_corretora.sql`

**Interfaces:**
- Produces: enum `corretora` (`'Ylos' | 'Zero Markets'`); coluna `public.contas.corretora corretora not null default 'Ylos'`; coluna `public.trades.corretora corretora not null` (preenchida por trigger a partir da conta); `public.trades.contratos` passa de `integer` para `numeric(10,2)`; função `public.valor_do_ponto(a ativo, c corretora)` substitui `public.valor_do_ponto(a ativo)`; as colunas geradas `trades.stop_dolar`/`trades.resultado_pontos` passam a depender de `(ativo, corretora)`. Toda task seguinte que lê `contas.corretora` ou `trades.corretora` depende deste arquivo já ter rodado no Supabase.

- [ ] **Step 1: Escrever o arquivo de migração**

Diferente do `0002` (que adicionava um valor a um enum já existente com `ALTER TYPE ... ADD VALUE`, e por isso precisava de duas etapas), aqui o enum `corretora` é criado do zero — pode ser usado na mesma transação, então **o arquivo roda de uma vez só**.

```sql
-- =============================================================================
-- AION — valor do ponto por corretora (Ylos × Zero Markets)
--
-- Diferente do 0002, este arquivo roda INTEIRO de uma vez só: `corretora` é um
-- enum novo, não um valor adicionado a um enum existente, então não esbarra na
-- restrição do Postgres sobre `ALTER TYPE ... ADD VALUE`.
-- =============================================================================

-- 1. Enum e coluna em `contas` ------------------------------------------------
-- Default 'Ylos' porque a tabela de valor do ponto de hoje já É a da Ylos —
-- nenhum trade já gravado muda de valor com esta migração.

create type corretora as enum ('Ylos', 'Zero Markets');

alter table public.contas
  add column corretora corretora not null default 'Ylos';

-- 2. Remove as colunas geradas antigas antes de trocar a função ---------------
-- Uma coluna GENERATED trava a função que ela usa; precisa sair primeiro.

alter table public.trades drop column stop_dolar;
alter table public.trades drop column resultado_pontos;

drop function public.valor_do_ponto(ativo);

-- 3. Nova função: valor do ponto passa a depender também da corretora --------
-- null = a corretora não oferece o ativo (hoje só WIN na Zero Markets).
-- MCL na Zero Markets é medido em pontos (não em %): 1 ponto do WTI = 1
-- centavo de preço, 1 lote = 1000 barris, logo US$10 por ponto, fixo.

create or replace function public.valor_do_ponto(a ativo, c corretora)
returns numeric
language sql
immutable
parallel safe
as $$
  select case c
    when 'Ylos' then
      case a
        when 'MES' then 5.0
        when 'MYM' then 0.5
        when 'MNQ' then 2.0
        when 'MGC' then 10.0
        when 'MCL' then 100.0
        when 'MBT' then 0.1
        when 'WIN' then 0.2
      end
    when 'Zero Markets' then
      case a
        when 'MES' then 1.0
        when 'MYM' then 1.0
        when 'MNQ' then 1.0
        when 'MGC' then 100.0
        when 'MCL' then 10.0
        when 'MBT' then 1.0
        when 'WIN' then null
      end
  end
$$;

-- 4. `trades.corretora`: preenchida a partir da conta, não digitada ----------
-- Todo trade existente é da Ylos (default da coluna em `contas` acima cobre o
-- update abaixo automaticamente).

alter table public.trades add column corretora corretora;

update public.trades t
set corretora = c.corretora
from public.contas c
where c.id = t.conta_id;

alter table public.trades alter column corretora set not null;

-- 5. Lote fracionário: a Zero Markets opera tamanhos como 0,10 -----------------

alter table public.trades alter column contratos type numeric(10,2);

-- 6. Recria as colunas geradas usando `valor_do_ponto(ativo, corretora)` -----

alter table public.trades add column stop_dolar numeric(14, 2)
  generated always as (pontos_stop * valor_do_ponto(ativo, corretora) * contratos) stored;

alter table public.trades add column resultado_pontos numeric(14, 4)
  generated always as (resultado / nullif(valor_do_ponto(ativo, corretora) * contratos, 0)) stored;

-- 7. Trigger: todo trade novo (ou que trocar de conta) herda a corretora -----
-- Dispara só em insert e em update de conta_id — o trade guarda a corretora
-- onde foi executado, mesmo que a conta mude de corretora depois.

create or replace function public.trades_definir_corretora()
returns trigger
language plpgsql
as $$
begin
  select c.corretora into new.corretora
  from public.contas c
  where c.id = new.conta_id;
  return new;
end;
$$;

create trigger trades_corretora_da_conta
  before insert or update of conta_id on public.trades
  for each row
  execute function public.trades_definir_corretora();

-- 8. Trava: nunca gravar um ativo que a corretora do trade não oferece -------

alter table public.trades
  add constraint trades_ativo_da_corretora
  check (valor_do_ponto(ativo, corretora) is not null);
```

- [ ] **Step 2: Rodar no Supabase**

No painel do Supabase do projeto AION → SQL Editor: colar o arquivo inteiro e rodar.

Esperado: `Success. No rows returned.`

- [ ] **Step 3: Conferir manualmente**

No SQL Editor, rodar:

```sql
select public.valor_do_ponto('MNQ', 'Ylos'), public.valor_do_ponto('MNQ', 'Zero Markets');
select public.valor_do_ponto('MCL', 'Zero Markets');
select public.valor_do_ponto('WIN', 'Zero Markets');
select corretora, count(*) from public.trades group by corretora;
select corretora from public.contas limit 5;
```

Esperado, nesta ordem: `2 | 1`; `10`; `null` (nenhuma linha de resultado com erro); todos os trades existentes com `corretora = 'Ylos'`; todas as contas existentes com `corretora = 'Ylos'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migracoes/0003_corretora.sql
git commit -m "feat(db): add per-broker point value (Ylos x Zero Markets)"
```

---

## Task 2: `ativos.ts` + `metricas.ts` — ficha por corretora

**Files:**
- Modify: `src/lib/ativos.ts`
- Modify: `src/lib/metricas.ts`
- Modify: `src/lib/metricas.check.ts`

**Interfaces:**
- Consumes: nada de outras tasks (módulo puro, sem banco).
- Produces: `export const CORRETORAS = ["Ylos", "Zero Markets"] as const`; `export type Corretora`; `export function valorPonto(codigo: Ativo, corretora: Corretora): number | null`; `export function unidadeDoStop(codigo: Ativo, corretora: Corretora): string | null`; `export function ativosDaCorretora(corretora: Corretora)`; `export function unidadeDaQuantidade(corretora: Corretora): "Contratos" | "Lotes"`; `stopEmDolar(pontosStop, ativo, contratos, corretora): number | null`; `resultadoEmPontos(resultado, ativo, contratos, corretora): number | null`. Toda task seguinte que calcula valor do ponto, filtra ativos por corretora, ou rotula o campo de quantidade depende destas assinaturas.

- [ ] **Step 1: Escrever as checagens (falham antes da implementação)**

Em `src/lib/metricas.check.ts`, trocar a linha de import de `ativos`:

```ts
import { ativosDaCorretora, moedaDoAtivo, unidadeDoStop, valorPonto } from "./ativos";
```

Trocar as três linhas que chamam `stopEmDolar`/`resultadoEmPontos` com a assinatura antiga:

```ts
// campos calculados
eq("stop MNQ 12,5 pts × 3 contratos (Ylos)", stopEmDolar(12.5, "MNQ", 3, "Ylos"), 75);
eq("stop MNQ 12,5 pts × 3 contratos (Zero Markets)", stopEmDolar(12.5, "MNQ", 3, "Zero Markets"), 37.5);
eq("stop MCL 0,18 × 1 (Ylos, %)", stopEmDolar(0.18, "MCL", 1, "Ylos"), 18);
// o dado que o usuário deu: 14 pontos × 0,10 lote na Zero Markets = US$14
eq("stop MCL 14 pontos × 0,10 lote (Zero Markets)", stopEmDolar(14, "MCL", 0.1, "Zero Markets"), 14);
// conferência anterior: 0,20% a WTI 90 = US$18
eq("stop MCL 18 pontos × 0,10 lote (Zero Markets, WTI a 90)", stopEmDolar(18, "MCL", 0.1, "Zero Markets"), 18);
eq("resultado em pontos (Ylos)", resultadoEmPontos(225, "MNQ", 3, "Ylos"), 37.5);
eq("WIN não existe na Zero Markets — stop sai nulo", stopEmDolar(10, "WIN", 1, "Zero Markets"), null);
eq("status de zerado", statusDoResultado(0), "Zerado");
```

Trocar as três linhas de ativo perto do fim do arquivo (antes de `console.log`):

```ts
// WIN entrou como ativo em BRL — os outros seis continuam em USD
eq("valor do ponto do WIN na Ylos", valorPonto("WIN", "Ylos"), 0.2);
eq("moeda nativa do WIN", moedaDoAtivo("WIN"), "BRL");
eq("moeda nativa do MES", moedaDoAtivo("MES"), "USD");

// Ylos × Zero Markets: mesmo ativo, valor do ponto diferente
eq("MNQ na Ylos", valorPonto("MNQ", "Ylos"), 2);
eq("MNQ na Zero Markets", valorPonto("MNQ", "Zero Markets"), 1);
eq("MGC na Zero Markets", valorPonto("MGC", "Zero Markets"), 100);
eq("MCL na Zero Markets é medido em pontos, não em %", valorPonto("MCL", "Zero Markets"), 10);
eq("WIN não tem ficha na Zero Markets", valorPonto("WIN", "Zero Markets"), null);

// rótulo da unidade: MGC e MBT são "dólares" nas duas corretoras (CLAUDE.md
// §3.2 já dizia isso; o código dizia "pontos" — corrigido aqui). MCL é o único
// que muda de fato entre corretoras: "%" na Ylos, "pontos" na Zero Markets.
eq("unidade do MGC na Ylos", unidadeDoStop("MGC", "Ylos"), "dólares");
eq("unidade do MGC na Zero Markets", unidadeDoStop("MGC", "Zero Markets"), "dólares");
eq("unidade do MBT na Ylos", unidadeDoStop("MBT", "Ylos"), "dólares");
eq("unidade do MBT na Zero Markets", unidadeDoStop("MBT", "Zero Markets"), "dólares");
eq("unidade do MCL na Ylos", unidadeDoStop("MCL", "Ylos"), "%");
eq("unidade do MCL na Zero Markets", unidadeDoStop("MCL", "Zero Markets"), "pontos");

// WIN simplesmente não aparece no seletor de ativos da Zero Markets
eq(
  "ativos da Zero Markets não incluem WIN",
  ativosDaCorretora("Zero Markets").some((a) => a.codigo === "WIN"),
  false,
);
eq(
  "ativos da Ylos incluem WIN",
  ativosDaCorretora("Ylos").some((a) => a.codigo === "WIN"),
  true,
);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run check`

Expected: falha (ou trava com exceção) nas checagens novas — `ativosDaCorretora` e `unidadeDoStop` ainda não existem em `ativos.ts`, e `valorPonto`/`stopEmDolar`/`resultadoEmPontos` ainda ignoram o argumento extra de corretora, então os valores da Zero Markets saem iguais aos da Ylos (errados) em vez dos valores esperados.

- [ ] **Step 3: Implementar — substituir `src/lib/ativos.ts` inteiro**

```ts
/**
 * Constante da aplicação — não é tabela, não é editável pelo usuário.
 * Ver CLAUDE.md, seção 3.2.
 */

export const ATIVOS = [
  { codigo: "MES", nome: "S&P", moeda: "USD" },
  { codigo: "MYM", nome: "Dow", moeda: "USD" },
  { codigo: "MNQ", nome: "Nasdaq", moeda: "USD" },
  { codigo: "MGC", nome: "Gold", moeda: "USD" },
  { codigo: "MCL", nome: "Oil", moeda: "USD" },
  { codigo: "MBT", nome: "Bitcoin", moeda: "USD" },
  { codigo: "WIN", nome: "Mini Índice", moeda: "BRL" },
] as const;

export type Ativo = (typeof ATIVOS)[number]["codigo"];
export type Moeda = (typeof ATIVOS)[number]["moeda"];

const PORCODIGO = new Map(ATIVOS.map((a) => [a.codigo, a]));

export function ativo(codigo: Ativo) {
  const a = PORCODIGO.get(codigo);
  if (!a) throw new Error(`Ativo desconhecido: ${codigo}`);
  return a;
}

/** WIN é o único ativo em BRL — os outros seis negociam em USD. Fixo pela bolsa, não muda com a corretora. */
export function moedaDoAtivo(codigo: Ativo): Moeda {
  return ativo(codigo).moeda;
}

/**
 * Cada corretora precifica o mesmo ativo de um jeito diferente — ver
 * CLAUDE.md, seção 3.2. Um ativo ausente da ficha de uma corretora (hoje só o
 * WIN na Zero Markets) simplesmente não é oferecido lá.
 */
export const CORRETORAS = ["Ylos", "Zero Markets"] as const;
export type Corretora = (typeof CORRETORAS)[number];

type Ficha = { valorPonto: number; unidade: string };

const FICHA: Record<Corretora, Partial<Record<Ativo, Ficha>>> = {
  Ylos: {
    MES: { valorPonto: 5, unidade: "dólares" },
    MYM: { valorPonto: 0.5, unidade: "dólares" },
    MNQ: { valorPonto: 2, unidade: "dólares" },
    MGC: { valorPonto: 10, unidade: "dólares" },
    // Pensado em %: 1% = 1,00 de movimento = $100 por contrato.
    MCL: { valorPonto: 100, unidade: "%" },
    MBT: { valorPonto: 0.1, unidade: "dólares" },
    WIN: { valorPonto: 0.2, unidade: "pontos" },
  },
  "Zero Markets": {
    MES: { valorPonto: 1, unidade: "dólares" },
    MYM: { valorPonto: 1, unidade: "dólares" },
    MNQ: { valorPonto: 1, unidade: "dólares" },
    MGC: { valorPonto: 100, unidade: "dólares" },
    // 1 ponto do WTI = 1 centavo de preço; 1 lote = 1000 barris → US$10/ponto, fixo.
    MCL: { valorPonto: 10, unidade: "pontos" },
    MBT: { valorPonto: 1, unidade: "dólares" },
    // WIN não é oferecido pela Zero Markets.
  },
};

/** Nulo quando a corretora não oferece o ativo (hoje só WIN na Zero Markets). */
export function valorPonto(codigo: Ativo, corretora: Corretora): number | null {
  ativo(codigo); // valida o código, mesmo quando a ficha não tem entrada
  return FICHA[corretora][codigo]?.valorPonto ?? null;
}

/** O rótulo do campo de stop muda conforme o ativo e a corretora: pontos, dólares ou %. */
export function unidadeDoStop(codigo: Ativo, corretora: Corretora): string | null {
  ativo(codigo);
  return FICHA[corretora][codigo]?.unidade ?? null;
}

/** Só os ativos que a corretora de fato oferece — usado para filtrar o seletor. */
export function ativosDaCorretora(corretora: Corretora) {
  return ATIVOS.filter((a) => FICHA[corretora][a.codigo] !== undefined);
}

/** Na Zero Markets o tamanho é fracionado (lote); na Ylos é sempre inteiro (contrato). */
export function unidadeDaQuantidade(corretora: Corretora): "Contratos" | "Lotes" {
  return corretora === "Zero Markets" ? "Lotes" : "Contratos";
}
```

- [ ] **Step 4: Implementar — `src/lib/metricas.ts`**

Trocar o import do topo:

```ts
import { valorPonto, type Ativo, type Corretora } from "./ativos";
```

Trocar as duas funções de campo calculado:

```ts
export function stopEmDolar(
  pontosStop: number,
  ativo: Ativo,
  contratos: number,
  corretora: Corretora,
): number | null {
  const ponto = valorPonto(ativo, corretora);
  if (ponto === null) return null;
  return pontosStop * ponto * contratos;
}

export function resultadoEmPontos(
  resultado: number,
  ativo: Ativo,
  contratos: number,
  corretora: Corretora,
): number | null {
  const ponto = valorPonto(ativo, corretora);
  if (ponto === null) return null;
  const divisor = ponto * contratos;
  if (divisor === 0) return null;
  return resultado / divisor;
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm run check`

Expected: todas as linhas `ok`, terminando em `tudo certo`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ativos.ts src/lib/metricas.ts src/lib/metricas.check.ts
git commit -m "feat: compute point value per broker (Ylos x Zero Markets)"
```

---

## Task 3: `Conta` ganha `corretora`

**Files:**
- Modify: `src/lib/tipos.ts`
- Modify: `src/lib/dados/contas.ts`
- Modify: `src/lib/dados/trades.ts:48-63` (só `contasParaSeletor`)

**Interfaces:**
- Consumes: `Corretora` de `@/lib/ativos` (Task 2). Depende da migração do Task 1 já ter rodado no Supabase (lê a coluna `contas.corretora`).
- Produces: `Conta.corretora: Corretora`; `referenciaDaContaPadrao(): Promise<{ mlpt: number; corretora: Corretora } | null>` (substitui `mlptDaContaPadrao`). Task 4 (tela Conta), Task 7 (Perfomance) e Task 8 (Backteste) consomem isso.

- [ ] **Step 1: `src/lib/tipos.ts`**

```ts
import type { Ativo, Corretora, Moeda } from "./ativos";

export type TempoGrafico = "1m" | "2m" | "3m" | "5m" | "15m" | "60m" | "1D";
export type TipoConta = "Remunerada" | "Simulador";
export type TipoLancamento = "Saque" | "Aporte";

export type Conta = {
  id: string;
  created_at: string;
  numero: string;
  tipo_conta: TipoConta;
  moeda: Moeda;
  corretora: Corretora;
  saldo_inicial: number;
  meta: number | null;
  mlpt: number;
  mlpd: number;
  is_padrao: boolean;
};
```

(O resto do arquivo — `Lancamento`, `ContaComSaldo`, `Estudo` — fica igual.)

- [ ] **Step 2: `src/lib/dados/contas.ts`**

Trocar o import do topo:

```ts
import type { Corretora, Moeda } from "@/lib/ativos";
```

Em `listarContas`, adicionar `corretora` ao objeto de retorno (junto de `moeda`):

```ts
      moeda: (conta.moeda ?? "USD") as Moeda,
      corretora: (conta.corretora ?? "Ylos") as Corretora,
      saldo_atual: saldo,
```

Substituir `mlptDaContaPadrao` por `referenciaDaContaPadrao`:

```ts
/** MLPT e corretora da conta padrão (ou da primeira cadastrada, na falta de uma padrão). */
export async function referenciaDaContaPadrao(): Promise<{ mlpt: number; corretora: Corretora } | null> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("contas")
    .select("mlpt, corretora")
    .order("is_padrao", { ascending: false })
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { mlpt: n(data.mlpt), corretora: (data.corretora ?? "Ylos") as Corretora };
}
```

Em `buscarConta`, incluir `corretora` no retorno:

```ts
export async function buscarConta(id: string): Promise<Conta | null> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.from("contas").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, moeda: (data.moeda ?? "USD") as Moeda, corretora: (data.corretora ?? "Ylos") as Corretora } as Conta;
}
```

- [ ] **Step 3: `src/lib/dados/trades.ts` — `contasParaSeletor`**

Trocar o import do topo:

```ts
import type { Ativo, Corretora, Moeda } from "@/lib/ativos";
```

Em `contasParaSeletor`, adicionar `corretora` ao objeto mapeado (junto de `moeda`):

```ts
    moeda: (c.moeda ?? "USD") as Moeda,
    corretora: (c.corretora ?? "Ylos") as Corretora,
  })) as Conta[];
```

- [ ] **Step 4: Rodar lint**

Run: `npm run lint`

Expected: erro em `src/app/(app)/backteste/[tempo]/page.tsx` (ainda importa `mlptDaContaPadrao`, que não existe mais) — esperado, resolvido no Task 8. Nenhum outro erro novo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tipos.ts src/lib/dados/contas.ts src/lib/dados/trades.ts
git commit -m "feat: add corretora to the Conta type and data layer"
```

---

## Task 4: Tela Conta — seletor de corretora

**Files:**
- Modify: `src/app/(app)/conta/formulario.tsx`
- Modify: `src/app/(app)/conta/acoes.ts`

**Interfaces:**
- Consumes: `Conta.corretora` (Task 3); `CORRETORAS`, `type Corretora` de `@/lib/ativos` (Task 2).
- Produces: nada que outra task consuma — a leitura de `conta.corretora` em outras telas vem de `lib/dados/contas.ts` (Task 3), que já repassa a coluna sem depender desta tela.

- [ ] **Step 1: `formulario.tsx` — importar e adicionar o estado**

Trocar o import de `ativos`:

```tsx
import { CORRETORAS, type Corretora, type Moeda } from "@/lib/ativos";
```

Logo após `const [moedaSelecionada, setMoedaSelecionada] = useState<Moeda>(conta?.moeda ?? "USD");`:

```tsx
  const [corretoraSelecionada, setCorretoraSelecionada] = useState<Corretora>(conta?.corretora ?? "Ylos");
```

- [ ] **Step 2: Adicionar o `fieldset` de corretora**

Logo depois do `fieldset` de "Moeda da conta" (antes do campo "Saldo inicial"):

```tsx
        <fieldset>
          <legend className={rotulo}>Corretora</legend>
          <div className="flex gap-1 rounded-[9px] border border-line-strong bg-input p-[3px]">
            {CORRETORAS.map((c) => (
              <label key={c} className="flex-1">
                <input
                  type="radio"
                  name="corretora"
                  value={c}
                  checked={corretoraSelecionada === c}
                  onChange={() => setCorretoraSelecionada(c)}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-md py-[7px] text-center text-[14.5px] font-medium text-ink-3 peer-checked:bg-raised peer-checked:text-ink">
                  {c}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
```

- [ ] **Step 3: Validar e persistir em `acoes.ts`**

Logo após `const moedaConta = String(dados.get("moeda") ?? "");`:

```ts
  const corretoraConta = String(dados.get("corretora") ?? "");
```

Logo após `if (moedaConta !== "USD" && moedaConta !== "BRL") return { erro: "Escolha a moeda da conta." };`:

```ts
  if (corretoraConta !== "Ylos" && corretoraConta !== "Zero Markets") return { erro: "Escolha a corretora da conta." };
```

Incluir no objeto `campos`:

```ts
  const campos = {
    numero: numeroConta,
    tipo_conta: tipo,
    moeda: moedaConta,
    corretora: corretoraConta,
    saldo_inicial: saldoInicial,
    meta,
    mlpt,
    mlpd,
    is_padrao: isPadrao,
  };
```

- [ ] **Step 4: Rodar lint**

Run: `npm run lint`

Expected: sem erros novos em `conta/formulario.tsx` ou `conta/acoes.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/conta/formulario.tsx src/app/\(app\)/conta/acoes.ts
git commit -m "feat: add broker field to the account form"
```

---

## Task 5: `Trade` ganha `corretora` e `contratos` fracionado

**Files:**
- Modify: `src/lib/dados/trades.ts:20-40` (tipo `Trade`), `:78-85` (mapeamento)
- Modify: `src/app/(app)/perfomance/acoes.ts`

**Interfaces:**
- Consumes: `Corretora` de `@/lib/ativos` (Task 2); a migração do Task 1 (colunas `trades.corretora` e `trades.contratos` já existem/mudaram de tipo no Supabase).
- Produces: `Trade.corretora: Corretora`; `Trade.contratos: number` (agora pode ser fracionário, ex. `0.1`). Task 6 e Task 7 dependem de `Trade.contratos` já vir como número JS, não string.

**Nota importante:** `contratos` era `integer` (PostgREST devolve como número JS direto). Depois do Task 1 ele é `numeric(10,2)`, e **PostgREST devolve `numeric` como string** — é por isso que `pontos_stop`, `resultado` etc. já passam por `n(...)` na função de mapeamento. Sem este ajuste, `t.contratos` viraria a string `"0.10"` em vez do número `0.1`, quebrando qualquer conta que use `contratos` (ex. `stopEmDolar`).

- [ ] **Step 1: Tipo `Trade`**

Em `src/lib/dados/trades.ts`, no tipo `Trade`, adicionar `corretora` (a mesma posição de `ativo`, já que os dois vêm juntos do banco):

```ts
export type Trade = {
  id: string;
  conta_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  ativo: Ativo;
  corretora: Corretora;
  tempo_grafico: TempoGrafico;
  setup_id: string;
  pontos_stop: number;
  contratos: number;
  resultado: number;
  risco_retorno: number | null;
  respeitou_plano: boolean;
  imagem_url: string | null;
  observacao: string | null;
  /** Calculados pelo banco — nunca digitados. */
  stop_dolar: number;
  resultado_pontos: number | null;
  status: "Gain" | "Loss" | "Zerado";
};
```

- [ ] **Step 2: Mapeamento — converter `contratos` explicitamente**

No `map` de `dadosDaPerfomance` que hoje é:

```ts
  const trades = (tradesResp.data ?? []).map((t) => ({
    ...t,
    pontos_stop: n(t.pontos_stop),
    resultado: n(t.resultado),
    stop_dolar: n(t.stop_dolar),
    resultado_pontos: t.resultado_pontos === null ? null : n(t.resultado_pontos),
    risco_retorno: t.risco_retorno === null ? null : n(t.risco_retorno),
  })) as Trade[];
```

adicionar a linha de `contratos`:

```ts
  const trades = (tradesResp.data ?? []).map((t) => ({
    ...t,
    pontos_stop: n(t.pontos_stop),
    contratos: n(t.contratos),
    resultado: n(t.resultado),
    stop_dolar: n(t.stop_dolar),
    resultado_pontos: t.resultado_pontos === null ? null : n(t.resultado_pontos),
    risco_retorno: t.risco_retorno === null ? null : n(t.risco_retorno),
  })) as Trade[];
```

- [ ] **Step 3: `perfomance/acoes.ts` — aceitar lote fracionário**

Trocar a validação:

```ts
  if (contratos === null || contratos <= 0) return { erro: "Informe a quantidade de contratos." };
```

(era `contratos < 1`)

E, no objeto `campos`, trocar `contratos: Math.round(contratos),` por:

```ts
    contratos,
```

(sem arredondar — arredondar para inteiro é exatamente o que quebrava o lote 0,10 da Zero Markets).

- [ ] **Step 4: Rodar lint**

Run: `npm run lint`

Expected: erros esperados em `formulario-trade.tsx`/`acoes-trade.tsx`/`perfomance/page.tsx` (ainda chamam `stopEmDolar`/`resultadoEmPontos` com a assinatura antiga de 3 argumentos, ou não passam `corretora`) — resolvidos nos Tasks 6 e 7. Nenhum erro novo em `dados/trades.ts` ou `perfomance/acoes.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dados/trades.ts src/app/\(app\)/perfomance/acoes.ts
git commit -m "feat: allow fractional lot sizes and thread trade corretora"
```

---

## Task 6: Formulário de trade — ativos por corretora e lote fracionário

**Files:**
- Modify: `src/app/(app)/perfomance/formulario-trade.tsx`

**Interfaces:**
- Consumes: `ativosDaCorretora`, `unidadeDoStop`, `unidadeDaQuantidade`, `type Corretora` de `@/lib/ativos` (Task 2); `stopEmDolar` com a assinatura nova (Task 2).
- Produces: `FormularioTrade` passa a exigir a prop `corretora: Corretora`. Task 7 (`acoes-trade.tsx`, `perfomance/page.tsx`) repassa essa prop.

- [ ] **Step 1: Imports e assinatura do componente**

Trocar o import de `ativos`:

```tsx
import { ativosDaCorretora, unidadeDaQuantidade, unidadeDoStop, type Ativo, type Corretora, type Moeda } from "@/lib/ativos";
```

Adicionar `corretora` à assinatura de `FormularioTrade`:

```tsx
export function FormularioTrade({
  contaId,
  setups,
  moedaConta,
  corretora,
  trade,
  aoFechar,
}: {
  contaId: string;
  setups: { id: string; nome: string }[];
  moedaConta: Moeda;
  corretora: Corretora;
  /** Presente = corrigindo um trade já salvo. */
  trade?: TradeParaEdicao;
  aoFechar?: () => void;
}) {
```

- [ ] **Step 2: Filtrar ativos por moeda ∩ corretora**

Trocar:

```tsx
  const ativosPermitidos = ATIVOS.filter((a) => a.moeda === moedaConta || a.codigo === trade?.ativo);
```

por:

```tsx
  const ativosPermitidos = ativosDaCorretora(corretora).filter(
    (a) => a.moeda === moedaConta || a.codigo === trade?.ativo,
  );
```

(Se `ATIVOS` não for mais usado em nenhum outro lugar deste arquivo depois desta troca, remover `ATIVOS` do import de `@/lib/ativos` — verificar com uma busca no arquivo antes de remover.)

- [ ] **Step 3: `unidade` e `stopDolar` levam a corretora**

Trocar:

```tsx
  const stopDolar = p !== null && c !== null && c > 0 ? stopEmDolar(p, ativo, c) : null;
```

por:

```tsx
  const stopDolar = p !== null && c !== null && c > 0 ? stopEmDolar(p, ativo, c, corretora) : null;
```

Trocar:

```tsx
  const unidade = ATIVOS.find((a) => a.codigo === ativo)?.unidade ?? "pontos";
```

por:

```tsx
  const unidade = unidadeDoStop(ativo, corretora) ?? "pontos";
```

- [ ] **Step 4: Rótulo e input de quantidade — "Contratos" ou "Lotes", decimal**

Trocar:

```tsx
                <label>
                  <span className={rotulo}>Contratos</span>
                  <input name="contratos" inputMode="numeric" value={contratos} onChange={(e) => setContratos(e.target.value)} placeholder="3" className={`${campo} num`} />
                </label>
```

por:

```tsx
                <label>
                  <span className={rotulo}>{unidadeDaQuantidade(corretora)}</span>
                  <input
                    name="contratos"
                    inputMode="decimal"
                    value={contratos}
                    onChange={(e) => setContratos(e.target.value)}
                    placeholder={corretora === "Zero Markets" ? "0,10" : "3"}
                    className={`${campo} num`}
                  />
                </label>
```

- [ ] **Step 5: Rodar lint**

Run: `npm run lint`

Expected: sem erros em `formulario-trade.tsx`. (Erros restantes em `acoes-trade.tsx`/`perfomance/page.tsx` por causa da prop `corretora` que ainda não existe lá — resolvidos no Task 7.)

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/perfomance/formulario-trade.tsx
git commit -m "feat: filter asset picker by broker and allow fractional lots"
```

---

## Task 7: Perfomance — repassar corretora e exibir contratos/lotes

**Files:**
- Modify: `src/app/(app)/perfomance/acoes-trade.tsx`
- Modify: `src/app/(app)/perfomance/page.tsx`

**Interfaces:**
- Consumes: `Conta.corretora` (Task 3); `FormularioTrade` exigindo `corretora` (Task 6); `unidadeDaQuantidade` de `@/lib/ativos` (Task 2).
- Produces: nada que outra task consuma — fecha a cadeia de props da Perfomance.

- [ ] **Step 1: `acoes-trade.tsx` — receber e repassar a corretora**

```tsx
import type { Corretora, Moeda } from "@/lib/ativos";

export function AcoesDoTrade({
  trade,
  contaId,
  setups,
  moedaConta,
  corretora,
}: {
  trade: TradeParaEdicao;
  contaId: string;
  setups: { id: string; nome: string }[];
  moedaConta: Moeda;
  corretora: Corretora;
}) {
```

Na chamada de `FormularioTrade` de edição:

```tsx
      {editando && (
        <FormularioTrade
          contaId={contaId}
          setups={setups}
          trade={trade}
          moedaConta={moedaConta}
          corretora={corretora}
          aoFechar={() => setEditando(false)}
        />
      )}
```

- [ ] **Step 2: `perfomance/page.tsx` — imports e as duas chamadas**

Trocar o import de `formato`/adicionar o de `ativos` (junto dos imports existentes):

```tsx
import { unidadeDaQuantidade } from "@/lib/ativos";
```

Trocar a chamada de `FormularioTrade` (dentro do `<header>`):

```tsx
          <FormularioTrade contaId={conta.id} setups={setups} moedaConta={conta.moeda} corretora={conta.corretora} />
```

Trocar a chamada de `AcoesDoTrade` (dentro do `<tbody>` da tabela):

```tsx
                        <AcoesDoTrade
                          trade={{ ...t, imagem: null }}
                          contaId={conta.id}
                          setups={setups}
                          moedaConta={conta.moeda}
                          corretora={conta.corretora}
                        />
```

- [ ] **Step 3: Cabeçalho da tabela — "Contratos" ou "Lotes"**

Trocar o array literal de cabeçalhos:

```tsx
                  {["Data", "Entrada", "Saída", "Ativo", "TG", "Setup", "Contratos", "Stop pts", "Stop $", "Resultado", "Pontos", "R:R", "Plano", "Status", ""].map((t, i) => (
```

por:

```tsx
                  {[
                    "Data", "Entrada", "Saída", "Ativo", "TG", "Setup",
                    unidadeDaQuantidade(conta.corretora),
                    "Stop pts", "Stop $", "Resultado", "Pontos", "R:R", "Plano", "Status", "",
                  ].map((t, i) => (
```

- [ ] **Step 4: Célula de contratos — vírgula decimal, igual ao stop em pontos**

Trocar:

```tsx
                      <td className={`${td} num text-right`}>{t.contratos}</td>
```

por:

```tsx
                      <td className={`${td} num text-right`}>{String(t.contratos).replace(".", ",")}</td>
```

- [ ] **Step 5: Rodar lint e build**

Run: `npm run lint && npm run build`

Expected: sem erros em `acoes-trade.tsx` ou `perfomance/page.tsx`. (O `npm run build` só fecha limpo depois do Task 8, que ainda tem uma referência pendente em `backteste/[tempo]/page.tsx`.)

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/perfomance/acoes-trade.tsx src/app/\(app\)/perfomance/page.tsx
git commit -m "feat: thread account broker through the Perfomance screen"
```

---

## Task 8: Backteste — unidade e tooltip por corretora

**Files:**
- Modify: `src/app/(app)/backteste/[tempo]/page.tsx`
- Modify: `src/app/(app)/backteste/[tempo]/tabela.tsx`

**Interfaces:**
- Consumes: `referenciaDaContaPadrao()` (Task 3); `valorPonto`, `unidadeDoStop`, `type Corretora` de `@/lib/ativos` (Task 2). O Backteste não é de uma conta — a lista de ativos oferecida na linha de cadastro continua todos os 7 (`ATIVOS`), sem filtrar por corretora; só o rótulo da unidade e o valor do ponto do tooltip seguem a corretora da conta padrão.
- Produces: nada que outra task consuma — fecha a cadeia de props do Backteste.

- [ ] **Step 1: `page.tsx` — trocar `mlptDaContaPadrao` por `referenciaDaContaPadrao`**

Trocar o import:

```tsx
import { referenciaDaContaPadrao } from "@/lib/dados/contas";
```

Trocar a chamada dentro do `Promise.all`:

```tsx
  const [{ linhas, resumo }, setups, total, referencia] = await Promise.all([
    listarBacktestes(tempo, filtros),
    listarSetupsSimples(),
    totalDoTempo(tempo),
    referenciaDaContaPadrao(),
  ]);
```

Trocar a chamada de `TabelaBackteste`:

```tsx
          <TabelaBackteste
            tempo={tempo}
            linhas={linhas}
            setups={setups}
            mlpt={referencia?.mlpt ?? null}
            corretora={referencia?.corretora ?? null}
          />
```

- [ ] **Step 2: `tabela.tsx` — imports e prop `corretora` em `TabelaBackteste`**

Trocar o import de `ativos`:

```tsx
import { ATIVOS, unidadeDoStop, valorPonto, type Corretora } from "@/lib/ativos";
```

Adicionar `corretora` à assinatura de `TabelaBackteste`:

```tsx
export function TabelaBackteste({
  tempo,
  linhas,
  setups,
  mlpt,
  corretora,
}: {
  tempo: string;
  linhas: Backteste[];
  setups: Setups;
  mlpt: number | null;
  corretora: Corretora | null;
}) {
```

Repassar `corretora` para a linha de cadastro nova e para as linhas em edição/salvas (três call sites):

```tsx
        <LinhaEditavel formId="nova-linha" tempo={tempo} setups={setups} inicial={null} corretora={corretora} />
```

```tsx
            <LinhaEditavel
              key={linha.id}
              formId={`editar-${linha.id}`}
              tempo={tempo}
              setups={setups}
              inicial={linha}
              numero={numero}
              corretora={corretora}
              aoFechar={() => setEditando(null)}
            />
          ) : (
            <LinhaSalva
              key={linha.id}
              linha={linha}
              numero={numero}
              tempo={tempo}
              setups={setups}
              mlpt={mlpt}
              corretora={corretora}
              aoEditar={() => setEditando(linha.id)}
            />
```

- [ ] **Step 3: `LinhaEditavel` — unidade do stop segue a corretora da conta padrão**

Adicionar `corretora` à assinatura:

```tsx
function LinhaEditavel({
  formId,
  tempo,
  setups,
  inicial,
  numero,
  corretora,
  aoFechar,
}: {
  formId: string;
  tempo: string;
  setups: Setups;
  inicial: Backteste | null;
  numero?: number;
  corretora: Corretora | null;
  aoFechar?: () => void;
}) {
```

Trocar:

```tsx
  const unidade = ATIVOS.find((a) => a.codigo === valor("ativo"))?.unidade ?? "pontos";
```

por (guarda a existência do código antes de chamar `unidadeDoStop`, que lança erro para código desconhecido — o campo pode estar vazio antes do usuário escolher um ativo):

```tsx
  const ativoAtual = valor("ativo");
  const unidade =
    (ATIVOS.some((a) => a.codigo === ativoAtual)
      ? unidadeDoStop(ativoAtual as (typeof ATIVOS)[number]["codigo"], corretora ?? "Ylos")
      : null) ?? "pontos";
```

- [ ] **Step 4: `LinhaSalva` e `ValorStopDolar` — tooltip com o valor certo da corretora**

Adicionar `corretora` à assinatura de `LinhaSalva`:

```tsx
function LinhaSalva({
  linha,
  numero,
  tempo,
  setups,
  mlpt,
  corretora,
  aoEditar,
}: {
  linha: Backteste;
  numero: number;
  tempo: string;
  setups: Setups;
  mlpt: number | null;
  corretora: Corretora | null;
  aoEditar: () => void;
}) {
```

Repassar para `ValorStopDolar`:

```tsx
          <ValorStopDolar ativo={linha.ativo} tamanhoStop={linha.tamanho_stop} mlpt={mlpt} corretora={corretora} />
```

Substituir `ValorStopDolar` inteiro:

```tsx
function ValorStopDolar({
  ativo,
  tamanhoStop,
  mlpt,
  corretora,
}: {
  ativo: string;
  tamanhoStop: number;
  mlpt: number | null;
  corretora: Corretora | null;
}) {
  const identidade = ATIVOS.find((a) => a.codigo === ativo);
  if (!identidade || !corretora || !Number.isFinite(tamanhoStop) || !mlpt) return null;

  const ponto = valorPonto(identidade.codigo, corretora);
  const unidadeStop = unidadeDoStop(identidade.codigo, corretora);
  if (ponto === null || unidadeStop === null) return null;

  const stopPorContrato = tamanhoStop * ponto;
  const contratos = contratosIdeais(stopPorContrato, mlpt);
  const singular = corretora === "Zero Markets" ? "lote" : "contrato";
  const plural = corretora === "Zero Markets" ? "lotes" : "contratos";

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Quantidade ideal de contratos para o MLPT da conta"
        className="flex size-[17px] items-center justify-center rounded-full border border-line-strong text-[10px] font-bold leading-none text-ink-4 group-hover:border-accent-soft group-hover:text-accent-soft group-focus-visible:border-accent-soft group-focus-visible:text-accent-soft"
      >
        {simboloDaMoeda(identidade.moeda)}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 w-max -translate-y-1/2 rounded-lg border border-line-strong bg-raised px-3 py-2 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="num whitespace-nowrap text-[12.5px] text-ink-4">
          {ativo} {String(tamanhoStop).replace(".", ",")} {unidadeStop}
        </span>
        {contratos >= 1 ? (
          <span className="num mt-1 flex items-center justify-between gap-3 whitespace-nowrap text-[12.5px]">
            <span className="text-ink-4">{contratos} {contratos === 1 ? singular : plural}</span>
            <span className="ml-3 font-semibold text-ink">{moeda(stopPorContrato * contratos, identidade.moeda)}</span>
          </span>
        ) : (
          <span className="mt-1 block whitespace-nowrap text-[12.5px] text-loss">
            Stop passa do MLPT com 1 {singular} só
          </span>
        )}
      </span>
    </span>
  );
}
```

- [ ] **Step 5: Rodar lint e build**

Run: `npm run lint && npm run build`

Expected: build limpo — este é o último arquivo pendente, o app inteiro deve compilar sem erros de tipo agora.

- [ ] **Step 6: Rodar a checagem completa**

Run: `npm run check`

Expected: `tudo certo`.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/backteste/\[tempo\]/page.tsx src/app/\(app\)/backteste/\[tempo\]/tabela.tsx
git commit -m "feat: show backtest unit label and sizing tooltip per broker"
```

---

## Task 9: `CLAUDE.md` — documentar corretora

**Files:**
- Modify: `CLAUDE.md` (na raiz deste repo `aion`)

**Interfaces:** nenhuma — documentação.

- [ ] **Step 1: Seção 3.2 — tabela por corretora**

Substituir a tabela única e o parágrafo seguinte por duas tabelas:

```markdown
### 3.2 Tabela de ativos (constante da aplicação, não editável pelo usuário)

O valor do ponto depende da corretora — cada uma precifica o contrato de um
jeito diferente. Um ativo ausente da tabela de uma corretora não é oferecido
nela (hoje, só o WIN não existe na Zero Markets).

**Ylos:**

| Código | Nome | Valor do ponto (na moeda do ativo) | Moeda | Rótulo da unidade |
|---|---|---|---|---|
| MES | S&P | 5,00 | USD | dólares |
| MYM | Dow | 0,50 | USD | dólares |
| MNQ | Nasdaq | 2,00 | USD | dólares |
| MGC | Gold | 10,00 | USD | dólares |
| MCL | Oil | 100,00 | USD | **%** |
| MBT | Bitcoin | 0,10 | USD | dólares |
| WIN | Mini Índice | 0,20 | BRL | pontos |

**Zero Markets:**

| Código | Nome | Valor do ponto (na moeda do ativo) | Moeda | Rótulo da unidade |
|---|---|---|---|---|
| MES | S&P | 1,00 | USD | dólares |
| MYM | Dow | 1,00 | USD | dólares |
| MNQ | Nasdaq | 1,00 | USD | dólares |
| MGC | Gold | 100,00 | USD | dólares |
| MCL | Oil | 10,00 | USD | pontos |
| MBT | Bitcoin | 1,00 | USD | dólares |
| WIN | — | — | — | não oferecido |

O rótulo da unidade muda o label do campo de stop conforme o ativo e a
corretora escolhidos. MCL é pensado em % na Ylos (1% = 1,00 de movimento =
$100 por contrato); na Zero Markets é medido em pontos (1 ponto do WTI =
1 centavo de preço; 1 lote = 1000 barris → US$10 por ponto, fixo) — é o único
ativo cuja unidade muda entre corretoras.

**Moeda por ativo, sem conversão.** Os campos derivados de `valor_ponto`
(`stop_dolar` em `trades`, MLPT/MLPD na conta, etc.) herdam a moeda do próprio
ativo — WIN produz valores em R$, os demais em US$. O app não converte entre
moedas; o nome dos campos (`stop_dolar`, "em USD") é histórico de quando só
havia ativos em dólar e deve ser lido como "na moeda do ativo/conta", não
literalmente USD.
```

- [ ] **Step 2: Seção 4 — `contas` e `trades`**

No bloco `### \`contas\``, adicionar o campo logo abaixo de `moeda`:

```markdown
- `moeda` (enum `USD` | `BRL`) — moeda de exibição da conta. [...]
- `corretora` (enum `Ylos` | `Zero Markets`) — de qual corretora vêm o valor do
  ponto e a unidade do stop desta conta. Default `Ylos`, para não alterar o
  valor de nenhum trade já registrado. Todo trade herda a corretora da conta
  no momento em que é gravado (não é digitado, nem editável depois).
```

No bloco `### \`trades\``, ajustar a frase sobre `stop_dolar`/`resultado_pontos`:

```markdown
**Campos calculados, nunca digitados** (evitam contradição entre números que
descrevem a mesma coisa):

- `stop_dolar` = `pontos_stop × valor_ponto(ativo, corretora) × contratos`
- `resultado_pontos` = `resultado ÷ (valor_ponto(ativo, corretora) × contratos)`
- `status` = `resultado > 0 → Gain` · `resultado < 0 → Loss` · `resultado = 0 → Zerado`

`contratos` é `numeric`, não inteiro — a Zero Markets opera lote fracionado
(ex. 0,10).
```

- [ ] **Step 3: Seção 5.1 — Conta**

```markdown
### 5.1 Conta

CRUD simples: número, tipo, moeda, corretora, saldo inicial, MLPT, marcar como
padrão. Ações: editar, remover. Sem filtros.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document per-broker point value and unit label"
```

---

## Task 10: Smoke test manual

**Files:** nenhum (validação end-to-end).

- [ ] **Step 1: Rodar o app localmente**

Run: `npm run dev`

- [ ] **Step 2: Criar uma conta na Zero Markets**

Em `/conta`, criar uma conta nova com corretora "Zero Markets", moeda "Dólar", MLPT/MLPD/saldo quaisquer.

- [ ] **Step 3: Lançar um trade de MCL nessa conta**

Em `/perfomance`, selecionar a conta Zero Markets, abrir "Novo trade", escolher MCL.

Expected: o campo de quantidade diz "Lotes" (não "Contratos"); o campo de stop diz "Stop em pontos" (não "%"); digitar `14` no stop e `0,10` no lote mostra "Stop inicial" calculado em `$14,00`.

- [ ] **Step 4: Lançar um trade de WIN nessa mesma conta**

No mesmo formulário, tentar trocar o ativo para WIN.

Expected: WIN não aparece na lista de ativos (a conta é Zero Markets, e WIN só existe na Ylos).

- [ ] **Step 5: Trocar para uma conta Ylos e repetir**

Selecionar uma conta Ylos no seletor do topo, abrir "Novo trade", escolher MCL.

Expected: o campo de quantidade diz "Contratos"; o campo de stop diz "Stop em %"; o mesmo valor de stop calcula um resultado diferente do trade da Zero Markets.

- [ ] **Step 6: Conferir a listagem da Perfomance**

Na tabela de trades da conta Zero Markets, conferir que a coluna de quantidade mostra "Lotes" no cabeçalho e `0,10` (com vírgula) na linha do trade de MCL.

- [ ] **Step 7: Conferir o Backteste**

Em `/backteste`, abrir um tempo gráfico, começar uma linha nova com ativo MCL.

Expected: se a conta padrão do usuário for Zero Markets, o campo de stop da linha nova diz "pontos"; passar o mouse sobre o ícone `$` mostra a sugestão de contratos/lotes calculada com o valor do ponto da Zero Markets (10, não 100).

- [ ] **Step 8: Editar um trade já existente (Ylos, dos dados antigos)**

Em uma conta Ylos com trades antigos, editar um trade de MNQ já registrado.

Expected: o valor calculado de "Stop inicial" bate com o valor de antes desta mudança (a Ylos não muda de comportamento).

- [ ] **Step 9: Reportar o resultado**

Se algum passo não bater com o esperado, anotar exatamente qual tela e qual valor, para virar um fix pontual — não um novo ciclo de brainstorming.

---

## Ordem de execução

Task 1 (SQL) e Task 2 (`ativos.ts`/`metricas.ts`) são independentes entre si e podem rodar em paralelo — nenhuma depende da outra para compilar ou passar `npm run check`, mas **as duas precisam estar concluídas antes do Task 3**, que já lê a coluna `contas.corretora` do banco. Task 3 bloqueia os Tasks 4, 5, 8 (todos leem `Conta.corretora` ou `referenciaDaContaPadrao`). Task 5 bloqueia o Task 6 (`Trade.contratos` como número) e o Task 7 (mesma razão, mais a prop `corretora` que o Task 6 introduz em `FormularioTrade`). Task 6 bloqueia o Task 7. Task 8 só depende dos Tasks 2 e 3, pode rodar em paralelo com 4, 5, 6, 7. Task 9 (docs) depende de todo o código estar fechado, para documentar o estado final, não um intermediário. Task 10 é sempre o último.
