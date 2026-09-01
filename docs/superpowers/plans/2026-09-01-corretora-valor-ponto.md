# Corretora e valor por ponto por corretora — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o valor por ponto (e a unidade do stop) de cada ativo depender da corretora da conta, não mais ser uma constante única da aplicação — para suportar o usuário operando também pela ZeroMarkets, com valores diferentes da Ylos.

**Architecture:** Nova tabela `valores_ponto_corretora` (por usuário, RLS) guarda valor por ponto + unidade por (corretora, ativo). `contas` ganha `corretora`. `trades` congela o valor por ponto usado em cada linha via trigger, porque uma *generated column* do Postgres não pode consultar outra tabela — as colunas geradas `stop_dolar`/`resultado_pontos` passam a ler essa coluna da própria linha em vez de chamar a função fixa `valor_do_ponto(ativo)`. Backteste não persiste nada: só resolve o valor via a conta padrão para exibir sugestões. Nova tela "Corretoras" edita a tabela.

**Tech Stack:** Next.js 15 (App Router, Server Components + Server Actions) + TypeScript + Supabase (Postgres/RLS) + Tailwind.

**Spec:** [docs/superpowers/specs/2026-09-01-corretora-valor-ponto-design.md](../specs/2026-09-01-corretora-valor-ponto-design.md)

## Global Constraints

- **Nada é compartilhado entre usuários** — `valores_ponto_corretora` é por `user_id`, com RLS igual às outras tabelas (CLAUDE.md, seção 1).
- **Valor por ponto do trade é congelado no cadastro** — editar a corretora depois não muda trades já salvos.
- **`unidade` só varia de fato para MCL** (`%` na Ylos, `pontos` na ZeroMarkets); os outros seis ativos usam `pontos` em toda corretora que os cobre. WIN só existe em B3.
- **Enum `corretora` fechado**: `Ylos` | `ZeroMarkets` | `B3`. USD → Ylos/ZeroMarkets; BRL → B3 (única praça do WIN).
- **MCL da ZeroMarkets nasce como placeholder** (igual à Ylos, 100.0) — o valor real ainda não foi confirmado; a unidade `pontos` já é confirmada.
- Sem framework de teste automatizado no projeto: verificação via `npm run lint`, `npm run build` (type-check) e `npm run check` (`tsx src/lib/metricas.check.ts`, script de conferência manual das funções puras).
- A migração SQL **não pode ser executada por quem está implementando** — não há credenciais de banco além da chave anônima do Supabase (`.env.local`). Ela precisa ser colada manualmente no SQL Editor do Supabase pelo usuário (mesmo fluxo das migrações 0001/0002) antes que as tarefas que dependem de dado real (telas rodando no navegador) possam ser verificadas de ponta a ponta.

---

## Task 1: Migração SQL — `corretora`, `valores_ponto_corretora`, `trades.valor_ponto`

**Files:**
- Create: `supabase/migracoes/0003_corretora.sql`

**Interfaces:**
- Produces (contrato de banco, consumido por todas as tarefas seguintes):
  - `create type corretora as enum ('Ylos', 'ZeroMarkets', 'B3');`
  - Tabela `public.valores_ponto_corretora(id, user_id, created_at, corretora, ativo, valor_ponto numeric, unidade text)`, únique `(user_id, corretora, ativo)`, RLS "dono".
  - `public.contas.corretora corretora not null` (backfill: BRL → `B3`, resto → `Ylos`).
  - `public.trades.valor_ponto numeric not null` (preenchido por trigger `trg_valor_ponto_trade`, não editável pelo usuário).
  - `stop_dolar`/`resultado_pontos` de `trades` recriadas como generated columns lendo `valor_ponto` da própria linha, em vez de `valor_do_ponto(ativo)`.

- [ ] **Step 1: Escrever a migração**

```sql
-- =============================================================================
-- AION — Corretora e valor por ponto por corretora
-- Cole inteiro no SQL Editor do Supabase e rode de uma vez (sem ALTER TYPE ...
-- ADD VALUE, então, diferente do 0002, não precisa ser rodado em duas etapas).
-- Ver docs/superpowers/specs/2026-09-01-corretora-valor-ponto-design.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enum + tabela de especificação por corretora (por usuário — nada é
-- compartilhado entre os três usuários, mesma regra do resto do app)
-- -----------------------------------------------------------------------------

create type corretora as enum ('Ylos', 'ZeroMarkets', 'B3');

create table public.valores_ponto_corretora (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  corretora   corretora not null,
  ativo       ativo not null,
  valor_ponto numeric not null,
  unidade     text not null, -- 'pontos' | 'dólares' | '%'

  constraint valores_ponto_corretora_positivo check (valor_ponto > 0),
  unique (user_id, corretora, ativo)
);

alter table public.valores_ponto_corretora enable row level security;
create policy "dono" on public.valores_ponto_corretora
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed: cada usuário existente nasce com sua própria cópia dos valores atuais
-- (Ylos/B3) e dos valores levantados para a ZeroMarkets. Oil (MCL) na
-- ZeroMarkets é um placeholder igual ao da Ylos — o valor real ainda não foi
-- confirmado; a unidade 'pontos' já é confirmada.
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
  ('ZeroMarkets'::corretora, 'MCL'::ativo, 100.0, 'pontos'),
  ('ZeroMarkets'::corretora, 'MBT'::ativo, 1.0,   'pontos')
) as v(corretora, ativo, valor_ponto, unidade);

-- -----------------------------------------------------------------------------
-- contas.corretora
-- -----------------------------------------------------------------------------

alter table public.contas add column corretora corretora not null default 'Ylos';
update public.contas set corretora = 'B3' where moeda = 'BRL';

-- -----------------------------------------------------------------------------
-- trades: valor_ponto congelado no cadastro (trigger). stop_dolar e
-- resultado_pontos passam a depender dele em vez de valor_do_ponto(ativo) —
-- uma generated column não pode consultar outra tabela para saber a
-- corretora da conta, então o valor precisa estar na própria linha.
-- -----------------------------------------------------------------------------

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

alter table public.trades drop column stop_dolar;
alter table public.trades drop column resultado_pontos;

alter table public.trades add column stop_dolar numeric(14, 2)
  generated always as (pontos_stop * valor_ponto * contratos) stored;
alter table public.trades add column resultado_pontos numeric(14, 4)
  generated always as (resultado / nullif(valor_ponto * contratos, 0)) stored;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migracoes/0003_corretora.sql
git commit -m "feat(db): adiciona corretora e valor por ponto por corretora"
```

- [ ] **Step 3: AÇÃO MANUAL — pedir para o usuário rodar a migração**

Esta migração não pode ser executada por quem implementa este plano — não há
credenciais de banco disponíveis além da chave anônima em `.env.local`. Antes
de qualquer tarefa que precise rodar a tela no navegador com dado real
(Tasks 5, 7, 9, 10), avise o usuário: "Cole o conteúdo de
`supabase/migracoes/0003_corretora.sql` no SQL Editor do Supabase e rode."
As Tasks 2–4, 6, 8 e 11 não dependem de banco rodando — só de `npm run
build`/`lint`/`check` — e podem prosseguir antes disso.

---

## Task 2: `ativos.ts` + `tipos.ts` — tipo `Corretora` e ATIVOS sem valor/unidade fixos

**Files:**
- Modify: `src/lib/ativos.ts`
- Modify: `src/lib/tipos.ts`

**Interfaces:**
- Produces:
  - `export const ATIVOS: { codigo: Ativo; nome: string; moeda: Moeda }[]` (perde `valorPonto` e `unidade`).
  - `export type Ativo`, `export type Moeda` (sem mudança de forma).
  - `export function ativo(codigo: Ativo)`, `export function moedaDoAtivo(codigo: Ativo): Moeda` (sem mudança de assinatura).
  - **Removidos**: `valorPonto(codigo)`, `unidadeDoStop(codigo)` — não existem mais.
  - `export const CORRETORAS: readonly ["Ylos", "ZeroMarkets", "B3"]`
  - `export type Corretora = "Ylos" | "ZeroMarkets" | "B3"`
  - `export function corretorasPorMoeda(moeda: Moeda): Corretora[]`
  - `Conta` (em `tipos.ts`) ganha `corretora: Corretora`.

- [ ] **Step 1: Reescrever `src/lib/ativos.ts`**

```ts
/**
 * Constante da aplicação — não é tabela, não é editável pelo usuário.
 * Ver CLAUDE.md, seção 3.2.
 *
 * Valor por ponto e unidade do stop NÃO estão aqui — variam por corretora
 * (ver src/lib/dados/corretoras.ts). Só nome e moeda são mesmo fixos do ativo.
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

/** WIN é o único ativo em BRL — os outros seis negociam em USD. */
export function moedaDoAtivo(codigo: Ativo): Moeda {
  return ativo(codigo).moeda;
}

/**
 * Corretora da conta. Fechada nesses três valores, como os demais enums do
 * app — uma quarta corretora é uma migration, não um cadastro.
 */
export const CORRETORAS = ["Ylos", "ZeroMarkets", "B3"] as const;
export type Corretora = (typeof CORRETORAS)[number];

/** USD opera por Ylos ou ZeroMarkets; BRL só tem B3 (única praça do WIN). */
export function corretorasPorMoeda(moeda: Moeda): Corretora[] {
  return moeda === "USD" ? ["Ylos", "ZeroMarkets"] : ["B3"];
}
```

- [ ] **Step 2: Adicionar `corretora` ao tipo `Conta` em `src/lib/tipos.ts`**

```ts
import type { Ativo, Corretora, Moeda } from "./ativos";
```

(troca a linha `import type { Ativo, Moeda } from "./ativos";` existente)

```ts
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

- [ ] **Step 3: Verificar que compila (vai falhar — call sites antigos ainda usam `valorPonto`/`unidadeDoStop`)**

Run: `npm run build`
Expected: FAIL — erros em `src/lib/metricas.ts`, `src/lib/metricas.check.ts`,
`src/app/(app)/perfomance/formulario-trade.tsx` e
`src/app/(app)/backteste/[tempo]/tabela.tsx` (funções/campos removidos). São
esperados — corrigidos nas próximas tarefas.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ativos.ts src/lib/tipos.ts
git commit -m "feat: adiciona tipo Corretora, remove valor por ponto/unidade fixos de ATIVOS"
```

---

## Task 3: `metricas.ts` + `metricas.check.ts` — valor por ponto como parâmetro

**Files:**
- Modify: `src/lib/metricas.ts`
- Modify: `src/lib/metricas.check.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores (funções puras).
- Produces:
  - `stopEmDolar(pontosStop: number, valorPonto: number, contratos: number): number`
  - `resultadoEmPontos(resultado: number, valorPonto: number, contratos: number): number | null`

- [ ] **Step 1: Atualizar as duas funções em `src/lib/metricas.ts`**

Trocar o import (linha 12, hoje `import { valorPonto, type Ativo } from "./ativos";`) e as duas funções:

```ts
export function stopEmDolar(
  pontosStop: number,
  valorPonto: number,
  contratos: number,
): number {
  return pontosStop * valorPonto * contratos;
}

export function resultadoEmPontos(
  resultado: number,
  valorPonto: number,
  contratos: number,
): number | null {
  const divisor = valorPonto * contratos;
  if (divisor === 0) return null;
  return resultado / divisor;
}
```

Remover o import de `valorPonto`/`Ativo` de `./ativos` **só se** nada mais no
arquivo usar o tipo `Ativo` — verificar com `grep -n "Ativo" src/lib/metricas.ts`
antes de decidir. Se `Ativo` não for usado em mais nenhuma assinatura do
arquivo, apagar a linha de import inteira; se for, trocar para
`import type { Ativo } from "./ativos";` sem `valorPonto`.

- [ ] **Step 2: Atualizar `src/lib/metricas.check.ts`**

Trocar o import (linha 21, hoje `import { moedaDoAtivo, valorPonto } from "./ativos";`):

```ts
import { moedaDoAtivo } from "./ativos";
```

Trocar as chamadas que passavam o código do ativo pelo valor por ponto numérico
(Ylos: MNQ = 2.0, MCL = 100.0 — os mesmos números que estavam em `ATIVOS`):

```ts
eq("stop MNQ 12,5 pts × 3 contratos", stopEmDolar(12.5, 2, 3), 75);
eq("stop MCL 0,18 × 1", stopEmDolar(0.18, 100, 1), 18);
eq("resultado em pontos", resultadoEmPontos(225, 2, 3), 37.5);
```

Remover a linha `eq("valor do ponto do WIN", valorPonto("WIN"), 0.2);` —
valor por ponto não é mais uma função pura testável sem banco; o que resta
testável de `ativos.ts` é só moeda:

```ts
// WIN entrou como ativo em BRL — os outros seis continuam em USD
eq("moeda nativa do WIN", moedaDoAtivo("WIN"), "BRL");
eq("moeda nativa do MES", moedaDoAtivo("MES"), "USD");
```

- [ ] **Step 3: Rodar a conferência**

Run: `npm run check`
Expected: `tudo certo` (exit 0), sem `FALHA`.

- [ ] **Step 4: Lint e build**

Run: `npm run lint && npm run build`
Expected: sem erros relacionados a `metricas.ts`/`metricas.check.ts` (ainda vai
falhar em `formulario-trade.tsx` e `tabela.tsx` — esperado até a Task 8/10).

- [ ] **Step 5: Commit**

```bash
git add src/lib/metricas.ts src/lib/metricas.check.ts
git commit -m "refactor: stopEmDolar/resultadoEmPontos recebem valor por ponto como parâmetro"
```

---

## Task 4: `dados/corretoras.ts` + `conta/corretoras/acoes.ts` — camada de dados

**Files:**
- Create: `src/lib/dados/corretoras.ts`
- Create: `src/app/(app)/conta/corretoras/acoes.ts`

**Interfaces:**
- Consumes: `Ativo`, `Corretora`, `CORRETORAS` de `@/lib/ativos`.
- Produces:
  - `type EspecificacaoAtivo = { valorPonto: number; unidade: string }`
  - `especificacoesDaCorretora(corretora: Corretora): Promise<Partial<Record<Ativo, EspecificacaoAtivo>>>`
  - `type LinhaCorretora = { ativo: Ativo; valorPonto: number; unidade: string }`
  - `listarCorretoras(): Promise<{ corretora: Corretora; ativos: LinhaCorretora[] }[]>`
  - `atualizarEspecificacao(_anterior: EstadoEspecificacao, dados: FormData): Promise<EstadoEspecificacao>` (Server Action)
  - `type EstadoEspecificacao = { erro?: string; ok?: boolean }`

- [ ] **Step 1: Criar `src/lib/dados/corretoras.ts`**

```ts
import "server-only";

import { CORRETORAS, type Ativo, type Corretora } from "@/lib/ativos";
import { clienteServidor } from "@/lib/supabase/servidor";

const n = (v: unknown) => Number(v ?? 0);

export type EspecificacaoAtivo = { valorPonto: number; unidade: string };

/** Valor por ponto + unidade de cada ativo, para a corretora informada. */
export async function especificacoesDaCorretora(
  corretora: Corretora,
): Promise<Partial<Record<Ativo, EspecificacaoAtivo>>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("valores_ponto_corretora")
    .select("ativo, valor_ponto, unidade")
    .eq("corretora", corretora);
  if (error) throw error;

  const mapa: Partial<Record<Ativo, EspecificacaoAtivo>> = {};
  for (const linha of data ?? []) {
    mapa[linha.ativo as Ativo] = { valorPonto: n(linha.valor_ponto), unidade: String(linha.unidade) };
  }
  return mapa;
}

export type LinhaCorretora = { ativo: Ativo; valorPonto: number; unidade: string };

/** As três corretoras, cada uma com os ativos que ela cobre — para a tela Corretoras. */
export async function listarCorretoras(): Promise<
  { corretora: Corretora; ativos: LinhaCorretora[] }[]
> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("valores_ponto_corretora")
    .select("corretora, ativo, valor_ponto, unidade")
    .order("corretora")
    .order("ativo");
  if (error) throw error;

  const porCorretora = new Map<Corretora, LinhaCorretora[]>();
  for (const linha of data ?? []) {
    const corretora = linha.corretora as Corretora;
    const lista = porCorretora.get(corretora) ?? [];
    lista.push({
      ativo: linha.ativo as Ativo,
      valorPonto: n(linha.valor_ponto),
      unidade: String(linha.unidade),
    });
    porCorretora.set(corretora, lista);
  }

  return CORRETORAS.map((corretora) => ({ corretora, ativos: porCorretora.get(corretora) ?? [] }));
}
```

- [ ] **Step 2: Criar `src/app/(app)/conta/corretoras/acoes.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { UNIDADES } from "@/lib/opcoes";
import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoEspecificacao = { erro?: string; ok?: boolean };

/** "1.500,50" e "1500.50" viram 1500.5. */
function numero(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const limpo = texto.replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

const UNIDADES_VALIDAS: readonly string[] = UNIDADES;

export async function atualizarEspecificacao(
  _anterior: EstadoEspecificacao,
  dados: FormData,
): Promise<EstadoEspecificacao> {
  const corretora = String(dados.get("corretora") ?? "");
  const ativo = String(dados.get("ativo") ?? "");
  const valorPonto = numero(dados.get("valor_ponto"));
  const unidade = String(dados.get("unidade") ?? "");

  if (!corretora || !ativo) return { erro: "Dados inválidos." };
  if (valorPonto === null || valorPonto <= 0) {
    return { erro: "Informe um valor por ponto maior que zero." };
  }
  if (!UNIDADES_VALIDAS.includes(unidade)) return { erro: "Escolha a unidade." };

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("valores_ponto_corretora")
    .update({ valor_ponto: valorPonto, unidade })
    .eq("corretora", corretora)
    .eq("ativo", ativo);

  if (error) return { erro: error.message };

  revalidatePath("/conta/corretoras");
  return { ok: true };
}
```

Este Server Action ainda depende de `UNIDADES` (de `@/lib/opcoes`), criado na
Task 5 — o build só vai fechar depois dela. Isso é esperado.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dados/corretoras.ts "src/app/(app)/conta/corretoras/acoes.ts"
git commit -m "feat: camada de dados para especificações por corretora"
```

---

## Task 5: Tela "Corretoras"

**Files:**
- Modify: `src/lib/opcoes.ts`
- Create: `src/app/(app)/conta/corretoras/page.tsx`
- Create: `src/app/(app)/conta/corretoras/tabela.tsx`
- Modify: `src/app/(app)/conta/page.tsx`

**Interfaces:**
- Consumes: `listarCorretoras`, `LinhaCorretora` (Task 4, `@/lib/dados/corretoras`); `atualizarEspecificacao`, `EstadoEspecificacao` (Task 4, `./acoes`).
- Produces: `export const UNIDADES = ["pontos", "dólares", "%"] as const;` em `opcoes.ts`. Rota `/conta/corretoras`.

- [ ] **Step 1: Adicionar `UNIDADES` a `src/lib/opcoes.ts`**

Adicionar perto dos outros enums do topo do arquivo:

```ts
export const UNIDADES = ["pontos", "dólares", "%"] as const;
```

- [ ] **Step 2: Criar `src/app/(app)/conta/corretoras/tabela.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";

import { UNIDADES } from "@/lib/opcoes";

import { atualizarEspecificacao, type EstadoEspecificacao } from "./acoes";

const INICIAL: EstadoEspecificacao = {};

const celula =
  "h-[36px] w-full rounded-[7px] border border-line-strong bg-input px-[10px] text-[14px] text-ink outline-none focus:border-accent";

export function TabelaCorretoras({
  corretora,
  ativos,
}: {
  corretora: string;
  ativos: { ativo: string; valorPonto: number; unidade: string }[];
}) {
  return (
    <table className="w-full border-separate border-spacing-0">
      <thead>
        <tr className="text-left text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          <th className="pb-2 pr-3">Ativo</th>
          <th className="pb-2 pr-3">Valor por ponto</th>
          <th className="pb-2 pr-3">Unidade</th>
          <th className="pb-2" />
        </tr>
      </thead>
      <tbody>
        {ativos.map((a) => (
          <LinhaAtivo key={a.ativo} corretora={corretora} {...a} />
        ))}
      </tbody>
    </table>
  );
}

function LinhaAtivo({
  corretora,
  ativo,
  valorPonto,
  unidade,
}: {
  corretora: string;
  ativo: string;
  valorPonto: number;
  unidade: string;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, enviando] = useActionState(atualizarEspecificacao, INICIAL);
  const formId = `form-${corretora}-${ativo}`;

  useEffect(() => {
    if (estado.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha a edição só depois da Server Action confirmar
      setEditando(false);
    }
  }, [estado]);

  if (!editando) {
    return (
      <tr className="border-t border-line-soft">
        <td className="num py-2 pr-3 font-semibold">{ativo}</td>
        <td className="num py-2 pr-3">{String(valorPonto).replace(".", ",")}</td>
        <td className="py-2 pr-3 text-ink-3">{unidade}</td>
        <td className="py-2 text-right">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="text-[13px] font-medium text-accent-soft hover:underline"
          >
            Editar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-t border-line-soft">
        <td className="num py-2 pr-3 font-semibold">{ativo}</td>
        <td className="py-2 pr-3">
          <form id={formId} action={acao} className="contents">
            <input type="hidden" name="corretora" value={corretora} />
            <input type="hidden" name="ativo" value={ativo} />
            <input
              name="valor_ponto"
              form={formId}
              inputMode="decimal"
              defaultValue={String(valorPonto)}
              className={`${celula} num`}
            />
          </form>
        </td>
        <td className="py-2 pr-3">
          <select name="unidade" form={formId} defaultValue={unidade} className={celula}>
            {UNIDADES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </td>
        <td className="py-2 text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="text-[13px] text-ink-4 hover:text-ink-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form={formId}
              disabled={enviando}
              className="text-[13px] font-semibold text-accent-soft disabled:opacity-60"
            >
              {enviando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </td>
      </tr>
      {estado.erro && (
        <tr>
          <td colSpan={4} className="pb-2 pt-1 text-[12.5px] text-loss">{estado.erro}</td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 3: Criar `src/app/(app)/conta/corretoras/page.tsx`**

```tsx
import Link from "next/link";

import { listarCorretoras } from "@/lib/dados/corretoras";

import { TabelaCorretoras } from "./tabela";

export const metadata = { title: "Corretoras — AION" };

export default async function PaginaCorretoras() {
  const corretoras = await listarCorretoras();

  return (
    <>
      <header className="mb-5">
        <p className="mb-1.5 text-[14px] text-ink-3">
          <Link href="/conta">Conta</Link>
        </p>
        <h1 className="display text-[30px] leading-[1.05]">Corretoras</h1>
        <p className="mt-2 max-w-[560px] text-[14px] text-ink-3">
          Valor por ponto e unidade de cada ativo, por corretora. Editar aqui
          vale para toda conta marcada com essa corretora.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {corretoras.map((c) => (
          <section key={c.corretora} className="rounded-xl border border-line bg-card p-[22px]">
            <h2 className="display mb-4 text-[19px]">{c.corretora}</h2>
            <TabelaCorretoras corretora={c.corretora} ativos={c.ativos} />
          </section>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Link a partir de `src/app/(app)/conta/page.tsx`**

No `<header>` de `PaginaConta` (linhas 25-34), adicionar o link ao lado do
título, dentro da `<div>` que já envolve `<h1>`/`<p>`:

```tsx
<header className="mb-5 flex items-end justify-between">
  <div>
    <h1 className="display text-[30px] leading-[1.05]">Contas</h1>
    <p className="mt-2 text-[14px] text-ink-3">
      {contas.length === 0
        ? "Nenhuma conta ainda"
        : `${contas.length} ${contas.length === 1 ? "conta" : "contas"}${prontas > 0 ? ` · ${prontas} pronta${prontas > 1 ? "s" : ""} para saque` : ""}`}
    </p>
  </div>
  <Link href="/conta/corretoras" className="text-[14px] text-ink-3 hover:text-ink">
    Corretoras →
  </Link>
</header>
```

- [ ] **Step 5: Lint e build**

Run: `npm run lint && npm run build`
Expected: sem erros novos nos arquivos desta tarefa (ainda faltam as tarefas
de `formulario-trade.tsx`/`tabela.tsx` do Backteste).

- [ ] **Step 6: Commit**

```bash
git add src/lib/opcoes.ts "src/app/(app)/conta/corretoras" "src/app/(app)/conta/page.tsx"
git commit -m "feat: tela Corretoras para editar valor por ponto e unidade por corretora"
```

- [ ] **Step 7: Teste manual (depois que a migração da Task 1 tiver rodado)**

1. Rodar `npm run dev`, abrir `/conta`, clicar em "Corretoras →".
2. Ver os três cartões (Ylos, ZeroMarkets, B3) com os valores seedados —
   ZeroMarkets com os cinco valores reais + MCL como placeholder igual à
   Ylos, unidade `pontos` no MCL da ZeroMarkets (não `%`).
3. Clicar "Editar" em uma linha, mudar o valor, "Salvar" — confirmar que a
   linha volta ao modo leitura com o novo valor.

---

## Task 6: `dados/contas.ts` — corretora nas contas e conta padrão do Backteste

**Files:**
- Modify: `src/lib/dados/contas.ts`

**Interfaces:**
- Consumes: `Corretora` de `@/lib/ativos`.
- Produces:
  - `listarContas()`/`buscarConta()` — `Conta`/`ContaComSaldo` agora incluem `corretora`.
  - `contaPadraoParaBackteste(): Promise<{ mlpt: number | null; corretora: Corretora | null }>` — **substitui** `mlptDaContaPadrao()` (removida).

- [ ] **Step 1: Atualizar imports e as três funções**

```ts
import type { Corretora, Moeda } from "@/lib/ativos";
```

(troca `import type { Moeda } from "@/lib/ativos";`)

Em `listarContas`, no objeto retornado (onde já existe `moeda: (conta.moeda ?? "USD") as Moeda,`), adicionar:

```ts
corretora: (conta.corretora ?? "Ylos") as Corretora,
```

Substituir `mlptDaContaPadrao` por:

```ts
export type ContaPadraoBackteste = { mlpt: number | null; corretora: Corretora | null };

/** MLPT e corretora da conta padrão (ou da primeira cadastrada, na falta de uma padrão). */
export async function contaPadraoParaBackteste(): Promise<ContaPadraoBackteste> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("contas")
    .select("mlpt, corretora")
    .order("is_padrao", { ascending: false })
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { mlpt: null, corretora: null };
  return { mlpt: n(data.mlpt), corretora: (data.corretora ?? "Ylos") as Corretora };
}
```

Em `buscarConta`, no retorno (onde já existe `moeda: (data.moeda ?? "USD") as Moeda`), adicionar:

```ts
return { ...data, moeda: (data.moeda ?? "USD") as Moeda, corretora: (data.corretora ?? "Ylos") as Corretora } as Conta;
```

- [ ] **Step 2: Build (vai falhar em `backteste/[tempo]/page.tsx`, que ainda importa `mlptDaContaPadrao` — esperado até a Task 10)**

Run: `npm run build`
Expected: erro só em `src/app/(app)/backteste/[tempo]/page.tsx` (`mlptDaContaPadrao` não existe mais).

- [ ] **Step 3: Commit**

```bash
git add src/lib/dados/contas.ts
git commit -m "feat: conta ganha corretora; mlptDaContaPadrao vira contaPadraoParaBackteste"
```

---

## Task 7: Formulário de Conta — campo Corretora

**Files:**
- Modify: `src/app/(app)/conta/formulario.tsx`
- Modify: `src/app/(app)/conta/acoes.ts`

**Interfaces:**
- Consumes: `corretorasPorMoeda`, `type Corretora`, `type Moeda` de `@/lib/ativos` (Task 2).

- [ ] **Step 1: Atualizar `src/app/(app)/conta/formulario.tsx`**

Trocar o import do topo:

```ts
import { corretorasPorMoeda, type Corretora, type Moeda } from "@/lib/ativos";
```

Adicionar estado de corretora e trocar o handler de moeda (perto de
`const [moedaSelecionada, setMoedaSelecionada] = useState<Moeda>(conta?.moeda ?? "USD");`):

```ts
const [moedaSelecionada, setMoedaSelecionada] = useState<Moeda>(conta?.moeda ?? "USD");
const [corretoraSelecionada, setCorretoraSelecionada] = useState<Corretora>(
  conta?.corretora ?? corretorasPorMoeda(conta?.moeda ?? "USD")[0],
);

function trocarMoeda(m: Moeda) {
  setMoedaSelecionada(m);
  const opcoes = corretorasPorMoeda(m);
  if (!opcoes.includes(corretoraSelecionada)) setCorretoraSelecionada(opcoes[0]);
}
```

No fieldset "Moeda da conta", trocar `onChange={() => setMoedaSelecionada(m)}`
por `onChange={() => trocarMoeda(m)}`.

Logo depois do fieldset de moeda (antes de `<div><label ... htmlFor="saldo_inicial">`),
adicionar um novo fieldset:

```tsx
<fieldset>
  <legend className={rotulo}>Corretora</legend>
  <div className="flex gap-1 rounded-[9px] border border-line-strong bg-input p-[3px]">
    {corretorasPorMoeda(moedaSelecionada).map((c) => (
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

- [ ] **Step 2: Validar e persistir em `src/app/(app)/conta/acoes.ts`**

```ts
import { corretorasPorMoeda, type Corretora, type Moeda } from "@/lib/ativos";
```

Depois de `const moedaConta = String(dados.get("moeda") ?? "");`, adicionar:

```ts
const corretoraConta = String(dados.get("corretora") ?? "");
```

Depois de `if (moedaConta !== "USD" && moedaConta !== "BRL") return { erro: "Escolha a moeda da conta." };`,
adicionar:

```ts
if (!corretorasPorMoeda(moedaConta as Moeda).includes(corretoraConta as Corretora)) {
  return { erro: "Escolha uma corretora válida para a moeda selecionada." };
}
```

No objeto `campos`, adicionar `corretora: corretoraConta,` (junto de `moeda: moedaConta,`).

- [ ] **Step 3: Lint e build**

Run: `npm run lint && npm run build`
Expected: sem erros novos nestes dois arquivos.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/conta/formulario.tsx" "src/app/(app)/conta/acoes.ts"
git commit -m "feat: formulário de conta ganha campo Corretora, filtrado pela moeda"
```

- [ ] **Step 5: Teste manual (depois da migração da Task 1)**

1. `/conta` → Nova conta, escolher Dólar: opções de corretora devem ser
   Ylos/ZeroMarkets. Trocar para Real: só B3 aparece, e a seleção não fica
   presa numa opção inválida.
2. Salvar uma conta ZeroMarkets e confirmar que ela aparece salva com essa
   corretora (reabrir para editar).

---

## Task 8: Formulário de Trade — usa a especificação da corretora

**Files:**
- Modify: `src/app/(app)/perfomance/formulario-trade.tsx`
- Modify: `src/app/(app)/perfomance/acoes-trade.tsx`

**Interfaces:**
- Consumes: `EspecificacaoAtivo` de `@/lib/dados/corretoras` (Task 4); `stopEmDolar(pontosStop, valorPonto, contratos)` (Task 3).
- Produces: `FormularioTrade` e `AcoesDoTrade` ganham a prop obrigatória `especificacoes: Partial<Record<Ativo, EspecificacaoAtivo>>`.

- [ ] **Step 1: Atualizar `src/app/(app)/perfomance/formulario-trade.tsx`**

Trocar o import de tipos:

```ts
import { ATIVOS, type Ativo, type Moeda } from "@/lib/ativos";
import type { EspecificacaoAtivo } from "@/lib/dados/corretoras";
```

Adicionar a prop `especificacoes` à assinatura de `FormularioTrade`:

```ts
export function FormularioTrade({
  contaId,
  setups,
  moedaConta,
  especificacoes,
  trade,
  aoFechar,
}: {
  contaId: string;
  setups: { id: string; nome: string }[];
  moedaConta: Moeda;
  especificacoes: Partial<Record<Ativo, EspecificacaoAtivo>>;
  /** Presente = corrigindo um trade já salvo. */
  trade?: TradeParaEdicao;
  aoFechar?: () => void;
}) {
```

Trocar a linha do cálculo de `stopDolar`:

```ts
const stopDolar =
  p !== null && c !== null && c > 0 && especificacoes[ativo]
    ? stopEmDolar(p, especificacoes[ativo]!.valorPonto, c)
    : null;
```

Trocar a linha da `unidade`:

```ts
const unidade = especificacoes[ativo]?.unidade ?? "pontos";
```

- [ ] **Step 2: Atualizar `src/app/(app)/perfomance/acoes-trade.tsx`**

```ts
import type { Ativo, Moeda } from "@/lib/ativos";
import type { EspecificacaoAtivo } from "@/lib/dados/corretoras";
```

(troca `import type { Moeda } from "@/lib/ativos";`)

```ts
export function AcoesDoTrade({
  trade,
  contaId,
  setups,
  moedaConta,
  especificacoes,
}: {
  trade: TradeParaEdicao;
  contaId: string;
  setups: { id: string; nome: string }[];
  moedaConta: Moeda;
  especificacoes: Partial<Record<Ativo, EspecificacaoAtivo>>;
}) {
```

E repassar para `<FormularioTrade especificacoes={especificacoes} ... />`
(junto dos outros props já passados).

- [ ] **Step 3: Build (vai falhar em `perfomance/page.tsx`, que ainda não passa `especificacoes` — esperado até a Task 9)**

Run: `npm run build`
Expected: erro só em `src/app/(app)/perfomance/page.tsx` (prop obrigatória faltando).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/perfomance/formulario-trade.tsx" "src/app/(app)/perfomance/acoes-trade.tsx"
git commit -m "refactor: formulário de trade lê valor por ponto/unidade da corretora da conta"
```

---

## Task 9: Página da Perfomance — busca e repassa as especificações

**Files:**
- Modify: `src/lib/dados/trades.ts`
- Modify: `src/app/(app)/perfomance/page.tsx`

**Interfaces:**
- Consumes: `especificacoesDaCorretora` (Task 4); `FormularioTrade`/`AcoesDoTrade` exigindo `especificacoes` (Task 8).
- Produces: `contasParaSeletor()` retorna `Conta[]` com `corretora` preenchida.

- [ ] **Step 1: `contasParaSeletor` em `src/lib/dados/trades.ts`**

```ts
import type { Ativo, Corretora, Moeda } from "@/lib/ativos";
```

(troca `import type { Ativo, Moeda } from "@/lib/ativos";`)

No `.map` de `contasParaSeletor`, adicionar `corretora: (c.corretora ?? "Ylos") as Corretora,`
junto de `moeda: (c.moeda ?? "USD") as Moeda,`.

- [ ] **Step 2: `src/app/(app)/perfomance/page.tsx`**

```ts
import { especificacoesDaCorretora } from "@/lib/dados/corretoras";
```

Depois de `const { listagem, lancamentos, setups, resumo, curva, porDia } = await dadosDaPerfomance(conta, mes, filtros);`,
adicionar:

```ts
const especificacoes = await especificacoesDaCorretora(conta.corretora);
```

Passar a prop nos dois usos existentes:

```tsx
<FormularioTrade contaId={conta.id} setups={setups} moedaConta={conta.moeda} especificacoes={especificacoes} />
```

```tsx
<AcoesDoTrade
  trade={{ ...t, imagem: null }}
  contaId={conta.id}
  setups={setups}
  moedaConta={conta.moeda}
  especificacoes={especificacoes}
/>
```

- [ ] **Step 3: Lint e build**

Run: `npm run lint && npm run build`
Expected: sem erros no fluxo da Perfomance (Backteste ainda falha — Task 10).

- [ ] **Step 4: Commit**

```bash
git add src/lib/dados/trades.ts "src/app/(app)/perfomance/page.tsx"
git commit -m "feat: Perfomance resolve valor por ponto/unidade pela corretora da conta selecionada"
```

- [ ] **Step 5: Teste manual (depois da migração da Task 1 e de ter uma conta ZeroMarkets)**

1. Selecionar a conta ZeroMarkets na Perfomance, "Novo trade", escolher MES.
2. Conferir que "Stop inicial" usa US$1,00/pt (não US$5,00/pt da Ylos) e que
   o rótulo do campo de stop diz "Stop em pontos".
3. Salvar o trade; conferir na listagem que `stop_dolar` bate com o valor da
   ZeroMarkets.
4. Ir em Corretoras, mudar o valor de MES da ZeroMarkets, voltar à
   Perfomance: o trade já salvo continua com o valor antigo (congelado); um
   trade novo já usa o valor atualizado.

---

## Task 10: Backteste — sugestão pela conta padrão

**Files:**
- Modify: `src/app/(app)/backteste/[tempo]/page.tsx`
- Modify: `src/app/(app)/backteste/[tempo]/tabela.tsx`

**Interfaces:**
- Consumes: `contaPadraoParaBackteste` (Task 6); `especificacoesDaCorretora`, `EspecificacaoAtivo` (Task 4).
- Produces: `TabelaBackteste` ganha a prop `especificacoes: Partial<Record<Ativo, EspecificacaoAtivo>>` (substitui a leitura direta de `ATIVOS` para valor/unidade).

- [ ] **Step 1: `src/app/(app)/backteste/[tempo]/page.tsx`**

Trocar o import:

```ts
import { contaPadraoParaBackteste } from "@/lib/dados/contas";
import { especificacoesDaCorretora } from "@/lib/dados/corretoras";
```

Trocar a chamada em `Promise.all` (hoje `mlptDaContaPadrao(),`):

```ts
const [{ linhas, resumo }, setups, total, contaPadrao] = await Promise.all([
  listarBacktestes(tempo, filtros),
  listarSetupsSimples(),
  totalDoTempo(tempo),
  contaPadraoParaBackteste(),
]);

const especificacoes = await especificacoesDaCorretora(contaPadrao.corretora ?? "Ylos");
```

Trocar `<TabelaBackteste tempo={tempo} linhas={linhas} setups={setups} mlpt={mlpt} />`
por:

```tsx
<TabelaBackteste
  tempo={tempo}
  linhas={linhas}
  setups={setups}
  mlpt={contaPadrao.mlpt}
  especificacoes={especificacoes}
/>
```

- [ ] **Step 2: `src/app/(app)/backteste/[tempo]/tabela.tsx` — imports e `TabelaBackteste`**

Trocar o import do topo:

```ts
import { ATIVOS, type Ativo } from "@/lib/ativos";
import type { EspecificacaoAtivo } from "@/lib/dados/corretoras";
```

Adicionar a prop em `TabelaBackteste`:

```ts
export function TabelaBackteste({
  tempo,
  linhas,
  setups,
  mlpt,
  especificacoes,
}: {
  tempo: string;
  linhas: Backteste[];
  setups: Setups;
  mlpt: number | null;
  especificacoes: Partial<Record<Ativo, EspecificacaoAtivo>>;
}) {
```

Repassar `especificacoes` para as duas linhas editáveis (`LinhaEditavel` de
"nova-linha" e a `LinhaEditavel` dentro do `.map` de linhas em edição) e para
`LinhaSalva`:

```tsx
<LinhaEditavel formId="nova-linha" tempo={tempo} setups={setups} inicial={null} especificacoes={especificacoes} />
```

```tsx
<LinhaEditavel
  key={linha.id}
  formId={`editar-${linha.id}`}
  tempo={tempo}
  setups={setups}
  inicial={linha}
  numero={numero}
  especificacoes={especificacoes}
  aoFechar={() => setEditando(null)}
/>
```

```tsx
<LinhaSalva
  key={linha.id}
  linha={linha}
  numero={numero}
  tempo={tempo}
  setups={setups}
  mlpt={mlpt}
  especificacoes={especificacoes}
  aoEditar={() => setEditando(linha.id)}
/>
```

- [ ] **Step 3: `LinhaEditavel` — unidade vem da corretora**

Adicionar `especificacoes` à assinatura de `LinhaEditavel`:

```ts
function LinhaEditavel({
  formId,
  tempo,
  setups,
  inicial,
  numero,
  especificacoes,
  aoFechar,
}: {
  formId: string;
  tempo: string;
  setups: Setups;
  inicial: Backteste | null;
  numero?: number;
  especificacoes: Partial<Record<Ativo, EspecificacaoAtivo>>;
  aoFechar?: () => void;
}) {
```

Trocar a linha `const unidade = ATIVOS.find((a) => a.codigo === valor("ativo"))?.unidade ?? "pontos";`
por:

```ts
const unidade = especificacoes[valor("ativo") as Ativo]?.unidade ?? "pontos";
```

- [ ] **Step 4: `LinhaSalva` e `ValorStopDolar` — valor e unidade vêm da corretora**

Adicionar `especificacoes` à assinatura de `LinhaSalva`:

```ts
function LinhaSalva({
  linha,
  numero,
  tempo,
  setups,
  mlpt,
  especificacoes,
  aoEditar,
}: {
  linha: Backteste;
  numero: number;
  tempo: string;
  setups: Setups;
  mlpt: number | null;
  especificacoes: Partial<Record<Ativo, EspecificacaoAtivo>>;
  aoEditar: () => void;
}) {
```

Trocar a linha `<ValorStopDolar ativo={linha.ativo} tamanhoStop={linha.tamanho_stop} mlpt={mlpt} />`
por:

```tsx
<ValorStopDolar
  ativo={linha.ativo}
  tamanhoStop={linha.tamanho_stop}
  mlpt={mlpt}
  especificacao={especificacoes[linha.ativo as Ativo] ?? null}
/>
```

Reescrever `ValorStopDolar`:

```tsx
function ValorStopDolar({
  ativo,
  tamanhoStop,
  mlpt,
  especificacao,
}: {
  ativo: string;
  tamanhoStop: number;
  mlpt: number | null;
  especificacao: EspecificacaoAtivo | null;
}) {
  const dadosAtivo = ATIVOS.find((a) => a.codigo === ativo);
  if (!dadosAtivo || !especificacao || !Number.isFinite(tamanhoStop) || !mlpt) return null;

  const stopPorContrato = tamanhoStop * especificacao.valorPonto;
  const contratos = contratosIdeais(stopPorContrato, mlpt);

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Quantidade ideal de contratos para o MLPT da conta"
        className="flex size-[17px] items-center justify-center rounded-full border border-line-strong text-[10px] font-bold leading-none text-ink-4 group-hover:border-accent-soft group-hover:text-accent-soft group-focus-visible:border-accent-soft group-focus-visible:text-accent-soft"
      >
        {simboloDaMoeda(dadosAtivo.moeda)}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 w-max -translate-y-1/2 rounded-lg border border-line-strong bg-raised px-3 py-2 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="num whitespace-nowrap text-[12.5px] text-ink-4">
          {ativo} {String(tamanhoStop).replace(".", ",")} {especificacao.unidade}
        </span>
        {contratos >= 1 ? (
          <span className="num mt-1 flex items-center justify-between gap-3 whitespace-nowrap text-[12.5px]">
            <span className="text-ink-4">{contratos} {contratos === 1 ? "contrato" : "contratos"}</span>
            <span className="ml-3 font-semibold text-ink">{moeda(stopPorContrato * contratos, dadosAtivo.moeda)}</span>
          </span>
        ) : (
          <span className="mt-1 block whitespace-nowrap text-[12.5px] text-loss">
            Stop passa do MLPT com 1 contrato só
          </span>
        )}
      </span>
    </span>
  );
}
```

- [ ] **Step 5: Lint e build**

Run: `npm run lint && npm run build`
Expected: sem erros em nenhum arquivo do projeto — esta é a última tarefa de
código, o build deve fechar limpo.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/backteste/[tempo]/page.tsx" "src/app/(app)/backteste/[tempo]/tabela.tsx"
git commit -m "feat: Backteste sugere valor por ponto/unidade pela corretora da conta padrão"
```

- [ ] **Step 7: Teste manual (depois da migração da Task 1)**

1. Marcar a conta ZeroMarkets como padrão em `/conta`.
2. Abrir `/backteste/2m` (ou outro tempo gráfico), cadastrar uma linha de
   MES com stop preenchido — o tooltip ($) deve mostrar a quantidade de
   contratos calculada com o valor da ZeroMarkets, não da Ylos.
3. Cadastrar uma linha de MCL na conta padrão ZeroMarkets — o rótulo ao
   lado do campo de stop deve dizer "pontos", não "%".
4. Desmarcar a conta padrão (nenhuma conta padrão) — a tela não deve quebrar;
   cai no comportamento da Ylos.

---

## Task 11: Documentação — `CLAUDE.md`

**Files:**
- Modify: `aion/CLAUDE.md`

**Interfaces:** nenhuma — só documentação.

- [ ] **Step 1: Seção 3.2 — tabela de ativos**

Substituir a tabela de ativos (que hoje tem colunas "Valor do ponto" e
"Unidade da unidade" fixas) por uma versão sem essas duas colunas, e
adicionar um parágrafo logo abaixo explicando que valor por ponto e unidade
agora vivem em `valores_ponto_corretora` (por corretora, por usuário), com a
observação de que MCL é `%` na Ylos e `pontos` na ZeroMarkets — o caso que
motivou a mudança.

- [ ] **Step 2: Seção 4 — schema**

Em `contas`, adicionar `corretora` (enum `Ylos | ZeroMarkets | B3`) à lista
de campos, com a mesma nota de trava por moeda já usada para `moeda`. Em
`trades`, adicionar `valor_ponto` (preenchido por trigger, não digitado) à
lista de "campos calculados, nunca digitados", explicando que ele registra o
valor por ponto vigente no momento do cadastro (congelado — editar a
corretora depois não muda trades antigos). Adicionar uma nova subseção
`valores_ponto_corretora` descrevendo a tabela (corretora, ativo, valor
por ponto, unidade — por usuário).

- [ ] **Step 3: Seção 5 — telas**

Adicionar "Corretoras" à lista de telas (acessível a partir de Conta),
com uma frase curta descrevendo o que ela faz — edita valor por ponto e
unidade por corretora.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta corretora, valores_ponto_corretora e a tela Corretoras"
```

---

## Resumo de execução

1. Task 1 primeiro (migração) — mas o Step 3 dela (rodar no Supabase) é uma
   ação manual do usuário, não bloqueia o início das Tasks 2–4/6/8/11.
2. Tasks 2 → 3 → 4 em sequência (fundações: tipos, funções puras, dados).
3. Task 5 depois da 4 (tela Corretoras consome a camada de dados).
4. Task 6 pode rodar em paralelo com 4/5 (não depende delas).
5. Task 7 depois da 6 e da 2 (formulário de conta).
6. Task 8 depois da 4 e da 3 (formulário de trade).
7. Task 9 depois da 8 e da 6 (página da Perfomance amarra tudo).
8. Task 10 depois da 6 e da 4 (Backteste amarra tudo).
9. Task 11 por último, depois de tudo estar implementado — documenta o estado final.
10. A migração da Task 1 precisa ter rodado no Supabase antes dos testes
    manuais das Tasks 5, 7, 9 e 10.
