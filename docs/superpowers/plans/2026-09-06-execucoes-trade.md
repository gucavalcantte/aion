# Execuções parciais do trade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o usuário registrar, por trade, como a posição foi montada/desmontada (Parcial / Adição / Saída do trade), sem mudar nenhum número já calculado do trade.

**Architecture:** Tabela nova `execucoes_trade` (child de `trades`, cascade delete), aditiva — nenhuma coluna existente de `trades` muda. Uma função pura (`fechamentoDeExecucoes`) decide se a soma das execuções fecha a posição; ela roda tanto no cliente (feedback ao vivo, bloqueia o botão salvar) quanto na Server Action (nunca confia só no client). A Server Action grava o trade e depois substitui (delete + insert) as execuções daquele `trade_id`. A listagem da Perfomance ganha um indicador que expande a linha para mostrar o detalhamento; o formulário de edição pré-popula a lista.

**Tech Stack:** Next.js 15 App Router (Server Actions, `useActionState`), TypeScript, Supabase (Postgres + RLS), Tailwind. Sem framework de teste — este repo usa scripts `tsx` de conferência manual (`npm run check`) para lógica pura; UI e Server Actions são verificadas manualmente no navegador (mesmo padrão já usado nos specs anteriores do projeto).

**Spec:** `docs/superpowers/specs/2026-09-06-execucoes-trade-design.md`

## Global Constraints

- Nenhum campo hoje calculado em `trades` (`contratos`, `resultado`, `stop_dolar`, `resultado_pontos`, `status`, `valor_ponto`) muda de fonte ou de fórmula.
- Fechamento: `contratos + Σ(Adição) = Σ(Parcial) + Σ(Saída do trade)`, com pelo menos uma execução `'Saída do trade'` quando há qualquer execução.
- Validação roda no client (bloqueia o botão) **e** na Server Action (nunca confia só no client) — mesmo padrão dos demais campos obrigatórios de `salvarTrade`.
- RLS "dono" (`auth.uid() = user_id`) em toda tabela nova — mesmo padrão de `contas`, `trades`, `valores_ponto_corretora`.
- Migração em arquivo único, colável de uma vez no SQL Editor do Supabase (mesmo padrão do `0004`) — não há Supabase CLI configurado neste projeto, migrações são aplicadas manualmente.
- Sem preço por execução, sem horário por execução, sem validar ordem/sequência dos tipos — fora de escopo (ver spec).

---

## Task 1: Migração — enum e tabela `execucoes_trade`

**Files:**
- Create: `supabase/migracoes/0005_execucoes_trade.sql`

**Interfaces:**
- Produces: tabela `public.execucoes_trade(id, user_id, created_at, trade_id, tipo, quantidade, ordem, notas)`, enum `tipo_execucao_trade`. Usada por todas as tasks seguintes.

- [ ] **Step 1: Escrever o arquivo de migração**

```sql
-- =============================================================================
-- AION — execuções parciais do trade (parcial / adição / saída do trade)
--
-- Cole inteiro no SQL Editor do Supabase e rode de uma vez. Cria um enum novo
-- e uma tabela nova — não mexe em nenhuma coluna existente de `trades`, então
-- não há o problema de "unsafe use of new value of enum type" e uma etapa só
-- basta (mesmo caso do 0004).
--
-- Isto é só um LOG de como a posição foi montada/desmontada. `contratos`,
-- `resultado`, `stop_dolar`, `resultado_pontos` e `status` em `trades`
-- continuam exatamente como são hoje — nada aqui os recalcula.
-- =============================================================================

create type tipo_execucao_trade as enum ('Parcial', 'Adição', 'Saída do trade');

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

- [ ] **Step 2: Conferir a sintaxe**

Não há `supabase db push` neste projeto — a aplicação real é manual, no SQL Editor
do Supabase (Task 9 lembra disso antes do teste final). Por ora, só releia o
arquivo e confirme que segue exatamente o padrão do `0003_corretora.sql`
(mesmos nomes de política, mesma ordem enum → tabela → índice → RLS).

- [ ] **Step 3: Commit**

```bash
git add supabase/migracoes/0005_execucoes_trade.sql
git commit -m "feat: add execucoes_trade migration for partial fills log"
```

---

## Task 2: Enum de tipos no client (`opcoes.ts`)

**Files:**
- Modify: `src/lib/opcoes.ts:7-8`

**Interfaces:**
- Produces: `TIPOS_EXECUCAO: readonly ["Parcial", "Adição", "Saída do trade"]`, `type TipoExecucao`. Usado pelas Tasks 3, 4, 5, 6.

- [ ] **Step 1: Adicionar o array e o tipo**

Em `src/lib/opcoes.ts`, logo depois de:

```ts
export const ENTRADAS = ["Confirmada", "Antecipada"] as const;
export type Entrada = (typeof ENTRADAS)[number];
```

adicionar:

```ts
export const TIPOS_EXECUCAO = ["Parcial", "Adição", "Saída do trade"] as const;
export type TipoExecucao = (typeof TIPOS_EXECUCAO)[number];
```

- [ ] **Step 2: Conferir que o projeto ainda compila**

Run: `npx tsc --noEmit`
Expected: sem erros novos (o array é só aditivo).

- [ ] **Step 3: Commit**

```bash
git add src/lib/opcoes.ts
git commit -m "feat: add TIPOS_EXECUCAO enum"
```

---

## Task 3: Lógica pura de fechamento (`execucoes-trade.ts`) — TDD

**Files:**
- Create: `src/lib/execucoes-trade.ts`
- Create: `src/lib/execucoes-trade.check.ts`
- Modify: `package.json:8`

**Interfaces:**
- Consumes: `TipoExecucao` de `src/lib/opcoes.ts` (Task 2).
- Produces:
  - `type ExecucaoTrade = { id: string; tipo: TipoExecucao; quantidade: number; ordem: number; notas: string | null }` — usado pelas Tasks 4, 6, 7.
  - `type LinhaExecucao = { tipo: TipoExecucao; quantidade: number; notas: string | null }` — usado pelas Tasks 5, 6.
  - `function fechamentoDeExecucoes(contratos: number, linhas: LinhaExecucao[]): { alvo: number; somaSaida: number; falta: number; temSaida: boolean; fechado: boolean }` — usado pelas Tasks 5, 6.

- [ ] **Step 1: Escrever o check script primeiro (falhando — o módulo ainda não existe)**

Criar `src/lib/execucoes-trade.check.ts`:

```ts
/**
 * Conferência rápida do fechamento de execuções (parcial/adição/saída).
 * Roda com: tsx src/lib/execucoes-trade.check.ts
 * Não é suíte de teste — é o mínimo para não deixar salvar um trade com
 * contratos sobrando ou faltando.
 */

import { fechamentoDeExecucoes } from "./execucoes-trade";

let falhas = 0;

function eq(nome: string, obtido: unknown, esperado: unknown) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  const ok = a === b;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : ` — obtido ${a}, esperado ${b}`}`);
}

eq(
  "fecha certo sem adição",
  fechamentoDeExecucoes(3, [
    { tipo: "Parcial", quantidade: 2, notas: null },
    { tipo: "Saída do trade", quantidade: 1, notas: null },
  ]),
  { alvo: 3, somaSaida: 3, falta: 0, temSaida: true, fechado: true },
);

eq(
  "fecha certo com adição",
  fechamentoDeExecucoes(2, [
    { tipo: "Adição", quantidade: 1, notas: null },
    { tipo: "Parcial", quantidade: 2, notas: null },
    { tipo: "Saída do trade", quantidade: 1, notas: null },
  ]),
  { alvo: 3, somaSaida: 3, falta: 0, temSaida: true, fechado: true },
);

eq(
  "falta contrato para fechar",
  fechamentoDeExecucoes(3, [{ tipo: "Parcial", quantidade: 2, notas: null }]),
  { alvo: 3, somaSaida: 2, falta: 1, temSaida: false, fechado: false },
);

eq(
  "soma bate mas sem Saída do trade não fecha",
  fechamentoDeExecucoes(3, [{ tipo: "Parcial", quantidade: 3, notas: null }]),
  { alvo: 3, somaSaida: 3, falta: 0, temSaida: false, fechado: false },
);

eq(
  "soma além do alvo não fecha",
  fechamentoDeExecucoes(3, [{ tipo: "Saída do trade", quantidade: 4, notas: null }]),
  { alvo: 3, somaSaida: 4, falta: -1, temSaida: true, fechado: false },
);

eq(
  "sem nenhuma execução",
  fechamentoDeExecucoes(3, []),
  { alvo: 3, somaSaida: 0, falta: 3, temSaida: false, fechado: false },
);

if (falhas > 0) {
  console.log(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\ntudo certo.");
```

- [ ] **Step 2: Rodar e confirmar que falha (módulo não existe)**

Run: `npx tsx src/lib/execucoes-trade.check.ts`
Expected: erro do Node/tsx do tipo "Cannot find module './execucoes-trade'".

- [ ] **Step 3: Escrever a implementação**

Criar `src/lib/execucoes-trade.ts`:

```ts
import type { TipoExecucao } from "./opcoes";

export type ExecucaoTrade = {
  id: string;
  tipo: TipoExecucao;
  quantidade: number;
  ordem: number;
  notas: string | null;
};

export type LinhaExecucao = {
  tipo: TipoExecucao;
  quantidade: number;
  notas: string | null;
};

export type FechamentoDeExecucoes = {
  alvo: number;
  somaSaida: number;
  falta: number;
  temSaida: boolean;
  fechado: boolean;
};

/**
 * `contratos` é a entrada inicial do trade. Adição aumenta o alvo a fechar;
 * Parcial e Saída do trade são o que fecha. Precisa existir ao menos uma
 * execução de Saída do trade — sem ela, sobra contrato aberto sem explicação.
 */
export function fechamentoDeExecucoes(contratos: number, linhas: LinhaExecucao[]): FechamentoDeExecucoes {
  const somaAdicao = linhas
    .filter((l) => l.tipo === "Adição")
    .reduce((a, l) => a + l.quantidade, 0);
  const somaSaida = linhas
    .filter((l) => l.tipo === "Parcial" || l.tipo === "Saída do trade")
    .reduce((a, l) => a + l.quantidade, 0);
  const alvo = contratos + somaAdicao;
  const temSaida = linhas.some((l) => l.tipo === "Saída do trade");

  return { alvo, somaSaida, falta: alvo - somaSaida, temSaida, fechado: temSaida && alvo === somaSaida };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx tsx src/lib/execucoes-trade.check.ts`
Expected: seis linhas `ok`, terminando em "tudo certo.".

- [ ] **Step 5: Ligar ao script `check` do projeto**

Em `package.json`, trocar:

```json
"check": "tsx src/lib/metricas.check.ts"
```

por:

```json
"check": "tsx src/lib/metricas.check.ts && tsx src/lib/execucoes-trade.check.ts"
```

Run: `npm run check`
Expected: os dois scripts rodam, ambos terminando em sucesso.

- [ ] **Step 6: Commit**

```bash
git add src/lib/execucoes-trade.ts src/lib/execucoes-trade.check.ts package.json
git commit -m "feat: add fechamentoDeExecucoes with checks"
```

---

## Task 4: Camada de dados — buscar execuções por trade

**Files:**
- Modify: `src/lib/dados/trades.ts:1-19` (imports), `:52-69` (nova função, logo após `contasParaSeletor`), `:71-155` (`dadosDaPerfomance`)

**Interfaces:**
- Consumes: `ExecucaoTrade` de `src/lib/execucoes-trade.ts` (Task 3).
- Produces: `function execucoesPorTrades(tradeIds: string[]): Promise<Record<string, ExecucaoTrade[]>>`. `dadosDaPerfomance` passa a retornar também `execucoesPorTrade: Record<string, ExecucaoTrade[]>`. Usado pelas Tasks 6 e 7.

- [ ] **Step 1: Importar o tipo**

Em `src/lib/dados/trades.ts`, no bloco de imports, logo abaixo de:

```ts
import type { Entrada } from "@/lib/opcoes";
```

adicionar:

```ts
import type { ExecucaoTrade } from "@/lib/execucoes-trade";
```

- [ ] **Step 2: Adicionar `execucoesPorTrades`**

Logo depois do fim de `contasParaSeletor` (depois do `}` que fecha essa função, antes de `export async function dadosDaPerfomance`), adicionar:

```ts
export async function execucoesPorTrades(tradeIds: string[]): Promise<Record<string, ExecucaoTrade[]>> {
  if (tradeIds.length === 0) return {};

  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("execucoes_trade")
    .select("*")
    .in("trade_id", tradeIds)
    .order("ordem");
  if (error) throw error;

  const mapa: Record<string, ExecucaoTrade[]> = {};
  for (const row of data ?? []) {
    const lista = mapa[row.trade_id] ?? (mapa[row.trade_id] = []);
    lista.push({ id: row.id, tipo: row.tipo, quantidade: row.quantidade, ordem: row.ordem, notas: row.notas });
  }
  return mapa;
}
```

- [ ] **Step 3: Buscar e devolver no `dadosDaPerfomance`**

Dentro de `dadosDaPerfomance`, logo depois do bloco que constrói `trades` (depois do `})) as Trade[];` que fecha o `.map`), adicionar:

```ts
  const execucoesPorTrade = await execucoesPorTrades(trades.map((t) => t.id));
```

E no `return` da função (o objeto que começa com `return { trades, listagem, lancamentos, setups, ...`), adicionar `execucoesPorTrade,` logo depois de `trades,`:

```ts
  return {
    trades,
    execucoesPorTrade,
    listagem,
    lancamentos,
    setups,
```

- [ ] **Step 4: Conferir que compila**

Run: `npx tsc --noEmit`
Expected: sem erros (a tabela `execucoes_trade` ainda não existe no banco real, mas isso não afeta o typecheck — o cliente Supabase usado aqui não é tipado por schema).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dados/trades.ts
git commit -m "feat: fetch execucoes_trade grouped by trade in dadosDaPerfomance"
```

---

## Task 5: Server Action — validar e persistir execuções

**Files:**
- Modify: `src/app/(app)/perfomance/acoes.ts`

**Interfaces:**
- Consumes: `fechamentoDeExecucoes`, `LinhaExecucao` de `src/lib/execucoes-trade.ts` (Task 3); `TIPOS_EXECUCAO`, `TipoExecucao` de `src/lib/opcoes.ts` (Task 2).
- Produces: `salvarTrade` passa a ler os campos de formulário `teve_parciais`, `execucao_tipo` (multi), `execucao_quantidade` (multi), `execucao_notas` (multi) — nomes consumidos pela Task 6.

- [ ] **Step 1: Importar o necessário**

No topo de `src/app/(app)/perfomance/acoes.ts`, logo depois de:

```ts
import { clienteServidor } from "@/lib/supabase/servidor";
```

adicionar:

```ts
import { fechamentoDeExecucoes, type LinhaExecucao } from "@/lib/execucoes-trade";
import { TIPOS_EXECUCAO, type TipoExecucao } from "@/lib/opcoes";
```

- [ ] **Step 2: Helper para ler a lista de execuções do FormData**

Logo depois da função `decimal` (depois do `}` que a fecha, antes de `export async function salvarTrade`), adicionar:

```ts
function linhasDeExecucao(dados: FormData): LinhaExecucao[] {
  const tipos = dados.getAll("execucao_tipo");
  const quantidades = dados.getAll("execucao_quantidade");
  const notasCampo = dados.getAll("execucao_notas");
  const notaTexto = (v: FormDataEntryValue | undefined) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s;
  };
  return tipos.map((tipo, i) => ({
    tipo: String(tipo) as TipoExecucao,
    quantidade: Math.round(decimal(quantidades[i] ?? null) ?? 0),
    notas: notaTexto(notasCampo[i]),
  }));
}
```

- [ ] **Step 3: Validar o fechamento em `salvarTrade`**

Depois de:

```ts
  if (pontos === null || pontos <= 0) return { erro: "Informe o stop em pontos." };
  if (contratos === null || contratos < 1) return { erro: "Informe a quantidade de contratos." };
  if (resultado === null) return { erro: "Informe o resultado em dólar (use sinal negativo no loss)." };
```

adicionar, antes de `const rr = decimal(dados.get("risco_retorno"));`:

```ts
  const tevaParciais = dados.get("teve_parciais") === "on";
  const linhas = tevaParciais ? linhasDeExecucao(dados) : [];

  if (tevaParciais) {
    if (linhas.some((l) => !TIPOS_EXECUCAO.includes(l.tipo))) {
      return { erro: "Tipo de execução inválido." };
    }
    if (linhas.some((l) => l.quantidade < 1)) {
      return { erro: "Cada execução precisa de uma quantidade de contratos maior que zero." };
    }
    const fechamento = fechamentoDeExecucoes(Math.round(contratos), linhas);
    if (!fechamento.fechado) {
      if (!fechamento.temSaida) {
        return { erro: 'Inclua uma execução do tipo "Saída do trade" para fechar a posição.' };
      }
      return {
        erro:
          fechamento.falta > 0
            ? `Faltam ${fechamento.falta} contrato(s) para fechar a posição.`
            : `A soma das execuções passou ${Math.abs(fechamento.falta)} contrato(s) da quantidade da posição.`,
      };
    }
  }
```

- [ ] **Step 4: Gravar o trade e substituir as execuções**

Trocar:

```ts
  const { error } = id
    ? await supabase.from("trades").update(campos).eq("id", id)
    : await supabase.from("trades").insert(campos);
  if (error) return { erro: error.message };

  if (campos.imagem_url !== undefined && caminhoAntigo && caminhoAntigo !== campos.imagem_url) {
    await removerImagem(caminhoAntigo);
  }

  revalidatePath("/perfomance");
  revalidatePath("/conta");
  return { ok: true };
```

por:

```ts
  let tradeId = id;
  if (id) {
    const { error } = await supabase.from("trades").update(campos).eq("id", id);
    if (error) return { erro: error.message };
  } else {
    const { data, error } = await supabase.from("trades").insert(campos).select("id").single();
    if (error) return { erro: error.message };
    tradeId = data.id;
  }

  // Substitui sempre — inclusive quando o checkbox veio desmarcado, o que
  // apaga qualquer execução salva antes (evita log "fantasma" desatualizado).
  await supabase.from("execucoes_trade").delete().eq("trade_id", tradeId);
  if (linhas.length > 0) {
    const { error: erroExecucoes } = await supabase.from("execucoes_trade").insert(
      linhas.map((l, i) => ({ trade_id: tradeId, tipo: l.tipo, quantidade: l.quantidade, ordem: i, notas: l.notas })),
    );
    if (erroExecucoes) return { erro: erroExecucoes.message };
  }

  if (campos.imagem_url !== undefined && caminhoAntigo && caminhoAntigo !== campos.imagem_url) {
    await removerImagem(caminhoAntigo);
  }

  revalidatePath("/perfomance");
  revalidatePath("/conta");
  return { ok: true };
```

- [ ] **Step 5: Conferir que compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/perfomance/acoes.ts
git commit -m "feat: validate and persist trade executions in salvarTrade"
```

---

## Task 6: Formulário — checkbox, lista repetível e indicador ao vivo

**Files:**
- Modify: `src/app/(app)/perfomance/formulario-trade.tsx`

**Interfaces:**
- Consumes: `TIPOS_EXECUCAO`, `TipoExecucao` (Task 2); `fechamentoDeExecucoes`, `ExecucaoTrade` (Task 3); campos de formulário `teve_parciais`/`execucao_tipo`/`execucao_quantidade`/`execucao_notas` (Task 5).
- Produces: `TradeParaEdicao` ganha `execucoes: ExecucaoTrade[]` — consumido pela Task 7 (é quem monta esse objeto para editar um trade existente).

- [ ] **Step 1: Importar o necessário**

Trocar:

```ts
import { riscoRetornoSugerido, statusDoResultado, stopEmDolar } from "@/lib/metricas";
import { ENTRADAS, type Entrada, RISCO_RETORNO, TEMPOS_GRAFICOS } from "@/lib/opcoes";
```

por:

```ts
import { fechamentoDeExecucoes, type ExecucaoTrade, type LinhaExecucao } from "@/lib/execucoes-trade";
import { riscoRetornoSugerido, statusDoResultado, stopEmDolar } from "@/lib/metricas";
import { ENTRADAS, type Entrada, RISCO_RETORNO, TEMPOS_GRAFICOS, TIPOS_EXECUCAO } from "@/lib/opcoes";
```

- [ ] **Step 2: Estender `TradeParaEdicao`**

Trocar:

```ts
export type TradeParaEdicao = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  ativo: Ativo;
  tempo_grafico: string;
  setup_id: string;
  entrada: Entrada | null;
  pontos_stop: number;
  contratos: number;
  resultado: number;
  risco_retorno: number | null;
  respeitou_plano: boolean;
  observacao: string | null;
  imagem: string | null;
};
```

por:

```ts
export type TradeParaEdicao = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  ativo: Ativo;
  tempo_grafico: string;
  setup_id: string;
  entrada: Entrada | null;
  pontos_stop: number;
  contratos: number;
  resultado: number;
  risco_retorno: number | null;
  respeitou_plano: boolean;
  observacao: string | null;
  imagem: string | null;
  execucoes: ExecucaoTrade[];
};

type LinhaExecucaoForm = { tipo: TipoExecucaoDoForm; quantidade: string; notas: string };
type TipoExecucaoDoForm = (typeof TIPOS_EXECUCAO)[number];
```

- [ ] **Step 3: Estado local da lista de execuções**

Logo depois de:

```ts
  const [previa, setPrevia] = useState<string | null>(trade?.imagem ?? null);
  const arquivo = useRef<HTMLInputElement>(null);
```

adicionar:

```ts
  const [teveParciais, setTeveParciais] = useState((trade?.execucoes.length ?? 0) > 0);
  const [linhas, setLinhas] = useState<LinhaExecucaoForm[]>(
    trade?.execucoes.map((e) => ({ tipo: e.tipo, quantidade: String(e.quantidade), notas: e.notas ?? "" })) ?? [],
  );

  function adicionarLinha() {
    setLinhas((ls) => [...ls, { tipo: "Parcial", quantidade: "", notas: "" }]);
  }
  function removerLinha(i: number) {
    setLinhas((ls) => ls.filter((_, idx) => idx !== i));
  }
  function atualizarLinha(i: number, campo: keyof LinhaExecucaoForm, valor: string) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }
```

- [ ] **Step 4: Calcular o fechamento ao vivo**

Logo depois de (reaproveita o `c` que já existe, calculado ali perto):

```ts
  const p = num(pontos);
  const c = num(contratos);
  const r = num(resultado);
```

adicionar:

```ts
  const fechamento =
    c !== null
      ? fechamentoDeExecucoes(
          Math.round(c),
          linhas.map((l) => ({ tipo: l.tipo, quantidade: num(l.quantidade) ?? 0, notas: null })),
        )
      : null;
```

- [ ] **Step 5: Limpar também no reset pós-salvamento**

Trocar:

```ts
    if (!editando) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ver comentário acima
      setPontos(""); setContratos(""); setResultado(""); setRrManual(null); setPrevia(null);
      if (arquivo.current) arquivo.current.value = "";
    }
```

por:

```ts
    if (!editando) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ver comentário acima
      setPontos(""); setContratos(""); setResultado(""); setRrManual(null); setPrevia(null);
      setTeveParciais(false); setLinhas([]);
      if (arquivo.current) arquivo.current.value = "";
    }
```

- [ ] **Step 6: JSX — checkbox e lista repetível**

Trocar (o bloco Stop/Contratos/Stop inicial, seguido do bloco Resultado):

```tsx
              <div className="grid grid-cols-3 gap-4">
                <label>
                  <span className={rotulo}>Stop em {unidade}</span>
                  <input name="pontos_stop" inputMode="decimal" value={pontos} onChange={(e) => setPontos(e.target.value)} placeholder="12,5" className={`${campo} num`} />
                </label>
                <label>
                  <span className={rotulo}>Contratos</span>
                  <input name="contratos" inputMode="numeric" value={contratos} onChange={(e) => setContratos(e.target.value)} placeholder="3" className={`${campo} num`} />
                </label>
                <div>
                  <span className={rotulo}><Ponto />Stop inicial</span>
                  <div className={calculado}>
                    <span className="num">{stopDolar === null ? VAZIO : moeda(stopDolar, moedaConta)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
```

por:

```tsx
              <div className="grid grid-cols-3 gap-4">
                <label>
                  <span className={rotulo}>Stop em {unidade}</span>
                  <input name="pontos_stop" inputMode="decimal" value={pontos} onChange={(e) => setPontos(e.target.value)} placeholder="12,5" className={`${campo} num`} />
                </label>
                <label>
                  <span className={rotulo}>Contratos</span>
                  <input name="contratos" inputMode="numeric" value={contratos} onChange={(e) => setContratos(e.target.value)} placeholder="3" className={`${campo} num`} />
                </label>
                <div>
                  <span className={rotulo}><Ponto />Stop inicial</span>
                  <div className={calculado}>
                    <span className="num">{stopDolar === null ? VAZIO : moeda(stopDolar, moedaConta)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[11px] border border-line-strong bg-well p-4">
                <label className="flex cursor-pointer items-center gap-[10px] text-[14.5px] text-ink-2">
                  <input
                    type="checkbox"
                    name="teve_parciais"
                    checked={teveParciais}
                    onChange={(e) => {
                      setTeveParciais(e.target.checked);
                      if (e.target.checked && linhas.length === 0) adicionarLinha();
                    }}
                    className="size-[18px] appearance-none rounded-[5px] border border-line-strong bg-input checked:border-accent checked:bg-accent checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222.6%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M3 8.4l3.2 3.2L13 4.8%22/></svg>')] checked:bg-center checked:bg-no-repeat"
                  />
                  Teve parciais ou adições
                </label>

                {teveParciais && (
                  <div className="mt-4 flex flex-col gap-2.5">
                    {linhas.map((l, i) => (
                      <div key={i} className="grid grid-cols-[1fr_100px_1fr_32px] items-center gap-2">
                        <select
                          name="execucao_tipo"
                          value={l.tipo}
                          onChange={(e) => atualizarLinha(i, "tipo", e.target.value)}
                          className={`${campo} h-[38px] appearance-none text-[14px]`}
                        >
                          {TIPOS_EXECUCAO.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <input
                          name="execucao_quantidade"
                          inputMode="numeric"
                          value={l.quantidade}
                          onChange={(e) => atualizarLinha(i, "quantidade", e.target.value)}
                          placeholder="contratos"
                          className={`${campo} num h-[38px] text-[14px]`}
                        />
                        <input
                          name="execucao_notas"
                          value={l.notas}
                          onChange={(e) => atualizarLinha(i, "notas", e.target.value)}
                          placeholder="Notas (opcional)"
                          className={`${campo} h-[38px] text-[14px]`}
                        />
                        <button
                          type="button"
                          onClick={() => removerLinha(i)}
                          aria-label="Remover execução"
                          className="flex size-[32px] items-center justify-center text-ink-4 hover:text-loss"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                            <path d="M4 4l8 8M12 4l-8 8" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={adicionarLinha}
                      className="self-start text-[13.5px] font-medium text-accent-soft hover:underline"
                    >
                      + Adicionar execução
                    </button>

                    {fechamento && (
                      <p className={`mt-1 text-[13px] font-medium ${fechamento.fechado ? "text-gain" : fechamento.falta < 0 ? "text-loss" : "text-ink-3"}`}>
                        {fechamento.fechado
                          ? "✓ soma bate com a quantidade de contratos"
                          : fechamento.falta > 0
                            ? `faltam ${fechamento.falta} contrato${fechamento.falta === 1 ? "" : "s"} para fechar`
                            : !fechamento.temSaida
                              ? 'inclua uma execução de "Saída do trade" para fechar'
                              : `a soma passou ${Math.abs(fechamento.falta)} contrato${Math.abs(fechamento.falta) === 1 ? "" : "s"} da quantidade`}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
```

- [ ] **Step 7: Bloquear o salvar enquanto não fechar**

Trocar:

```tsx
              <button type="submit" disabled={enviando} className="h-[42px] rounded-[9px] bg-accent px-[19px] text-[15px] font-semibold text-accent-ink disabled:opacity-60">
                {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Salvar trade"}
              </button>
```

por:

```tsx
              <button
                type="submit"
                disabled={enviando || (teveParciais && (linhas.length === 0 || !fechamento?.fechado))}
                className="h-[42px] rounded-[9px] bg-accent px-[19px] text-[15px] font-semibold text-accent-ink disabled:opacity-60"
              >
                {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Salvar trade"}
              </button>
```

- [ ] **Step 8: Conferir que compila**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `TipoExecucaoDoForm`/`LinhaExecucaoForm` reclamarem de tipo, confirme que `l.tipo` em `atualizarLinha`/`setLinhas` está tipado como `TipoExecucaoDoForm` (alias de `TipoExecucao`) — o `<select>` só oferece os três valores de `TIPOS_EXECUCAO`, então o `e.target.value` sempre é um deles, mas o TS não sabe disso sozinho; se o compilador reclamar, troque `atualizarLinha(i, "tipo", e.target.value)` por `atualizarLinha(i, "tipo", e.target.value as TipoExecucaoDoForm)` só nessa chamada.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/perfomance/formulario-trade.tsx
git commit -m "feat: add partial fills checklist to trade form"
```

---

## Task 7: Listagem — indicador e expansão da linha

**Files:**
- Modify: `src/app/(app)/perfomance/tabela-trades.tsx`
- Modify: `src/app/(app)/perfomance/page.tsx:49`, `:327-334`

**Interfaces:**
- Consumes: `ExecucaoTrade` (Task 3), `execucoesPorTrade` de `dadosDaPerfomance` (Task 4), `TradeParaEdicao.execucoes` (Task 6).

- [ ] **Step 1: Importar `Fragment` e o tipo**

Trocar:

```tsx
"use client";

import { useState } from "react";

import type { Ativo, Moeda } from "@/lib/ativos";
import type { EspecificacaoAtivo } from "@/lib/dados/corretoras";
import type { Trade } from "@/lib/dados/trades";
```

por:

```tsx
"use client";

import { Fragment, useState } from "react";

import type { Ativo, Moeda } from "@/lib/ativos";
import type { EspecificacaoAtivo } from "@/lib/dados/corretoras";
import type { Trade } from "@/lib/dados/trades";
import type { ExecucaoTrade } from "@/lib/execucoes-trade";
```

- [ ] **Step 2: Nova prop e estado de expansão**

Trocar:

```tsx
export function TabelaTrades({
  listagem,
  totalTrades,
  setups,
  contaId,
  moedaConta,
  especificacoes,
}: {
  listagem: Trade[];
  totalTrades: number;
  setups: { id: string; nome: string }[];
  contaId: string;
  moedaConta: Moeda;
  especificacoes: Partial<Record<Ativo, EspecificacaoAtivo>>;
}) {
  const [pagina, setPagina] = useState(1);
```

por:

```tsx
export function TabelaTrades({
  listagem,
  totalTrades,
  setups,
  contaId,
  moedaConta,
  especificacoes,
  execucoesPorTrade,
}: {
  listagem: Trade[];
  totalTrades: number;
  setups: { id: string; nome: string }[];
  contaId: string;
  moedaConta: Moeda;
  especificacoes: Partial<Record<Ativo, EspecificacaoAtivo>>;
  execucoesPorTrade: Record<string, ExecucaoTrade[]>;
}) {
  const [pagina, setPagina] = useState(1);
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  function alternarExpansao(id: string) {
    setExpandido((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }
```

- [ ] **Step 3: Badge na célula de Contratos + linha de expansão**

Trocar:

```tsx
            {listagemPagina.map((t) => {
              const td = "whitespace-nowrap border-b border-line-soft bg-table-row px-[13px] py-[11px] text-[14.5px] text-ink-2 transition-colors group-hover:bg-raised";
              const setup = setups.find((s) => s.id === t.setup_id)?.nome ?? VAZIO;
              return (
                <tr key={t.id} className="group">
                  <td className={`${td} num`}>{fData(t.data)}</td>
                  <td className={`${td} num`}>{hora(t.hora_inicio)}</td>
                  <td className={`${td} num`}>{hora(t.hora_fim)}</td>
                  <td className={`${td} num font-semibold`}>{t.ativo}</td>
                  <td className={`${td} num`}>{t.tempo_grafico}</td>
                  <td className={td}>{setup}</td>
                  <td className={td}>{t.entrada ?? VAZIO}</td>
                  <td className={`${td} num text-right`}>{t.contratos}</td>
```

por:

```tsx
            {listagemPagina.map((t) => {
              const td = "whitespace-nowrap border-b border-line-soft bg-table-row px-[13px] py-[11px] text-[14.5px] text-ink-2 transition-colors group-hover:bg-raised";
              const setup = setups.find((s) => s.id === t.setup_id)?.nome ?? VAZIO;
              const execucoes = execucoesPorTrade[t.id] ?? [];
              return (
                <Fragment key={t.id}>
                <tr className="group">
                  <td className={`${td} num`}>{fData(t.data)}</td>
                  <td className={`${td} num`}>{hora(t.hora_inicio)}</td>
                  <td className={`${td} num`}>{hora(t.hora_fim)}</td>
                  <td className={`${td} num font-semibold`}>{t.ativo}</td>
                  <td className={`${td} num`}>{t.tempo_grafico}</td>
                  <td className={td}>{setup}</td>
                  <td className={td}>{t.entrada ?? VAZIO}</td>
                  <td className={`${td} num text-right`}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {t.contratos}
                      {execucoes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => alternarExpansao(t.id)}
                          aria-label={`${expandido.has(t.id) ? "Esconder" : "Ver"} execuções deste trade`}
                          className="num inline-flex h-[18px] items-center rounded-[5px] bg-accent-soft/20 px-[6px] text-[11px] font-semibold text-accent-soft"
                        >
                          {execucoes.length}
                        </button>
                      )}
                    </span>
                  </td>
```

E trocar o fechamento da linha (a `</tr>` que fecha essa row, logo antes do `);` que fecha o `.map`):

```tsx
                  <td className={td}>
                    <AcoesDoTrade
                      trade={{ ...t, imagem: null }}
                      contaId={contaId}
                      setups={setups}
                      moedaConta={moedaConta}
                      especificacoes={especificacoes}
                    />
                  </td>
                </tr>
              );
            })}
```

por:

```tsx
                  <td className={td}>
                    <AcoesDoTrade
                      trade={{ ...t, imagem: null, execucoes }}
                      contaId={contaId}
                      setups={setups}
                      moedaConta={moedaConta}
                      especificacoes={especificacoes}
                    />
                  </td>
                </tr>
                {expandido.has(t.id) && execucoes.length > 0 && (
                  <tr>
                    <td colSpan={16} className="border-b border-line-soft bg-well px-[13px] py-3">
                      <ul className="flex flex-col gap-1.5">
                        {execucoes.map((e) => (
                          <li key={e.id} className="flex items-center gap-3 text-[13.5px] text-ink-2">
                            <span className="num inline-flex h-[21px] min-w-[86px] items-center justify-center rounded-md bg-track px-[8px] text-[12px] font-semibold text-ink-3">
                              {e.tipo}
                            </span>
                            <span className="num font-medium">
                              {e.quantidade} contrato{e.quantidade === 1 ? "" : "s"}
                            </span>
                            {e.notas && <span className="text-ink-4">{e.notas}</span>}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
```

- [ ] **Step 4: Passar a prop nova em `page.tsx`**

Trocar:

```ts
  const { listagem, lancamentos, setups, resumo, curva, porDia } = await dadosDaPerfomance(conta, mes, filtros);
```

por:

```ts
  const { listagem, lancamentos, setups, resumo, curva, porDia, execucoesPorTrade } = await dadosDaPerfomance(conta, mes, filtros);
```

E trocar:

```tsx
        <TabelaTrades
          listagem={listagem}
          totalTrades={resumo.totalTrades}
          setups={setups}
          contaId={conta.id}
          moedaConta={conta.moeda}
          especificacoes={especificacoes}
        />
```

por:

```tsx
        <TabelaTrades
          listagem={listagem}
          totalTrades={resumo.totalTrades}
          setups={setups}
          contaId={conta.id}
          moedaConta={conta.moeda}
          especificacoes={especificacoes}
          execucoesPorTrade={execucoesPorTrade}
        />
```

- [ ] **Step 5: Conferir que compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/perfomance/tabela-trades.tsx src/app/\(app\)/perfomance/page.tsx
git commit -m "feat: show execution breakdown indicator in trades table"
```

---

## Task 8: CLAUDE.md — registrar a tabela nova

**Files:**
- Modify: `CLAUDE.md:212-215` (seção 4, dentro de `### \`trades\``, aion root)

**Interfaces:** nenhuma (documentação).

- [ ] **Step 1: Adicionar a nota**

No `CLAUDE.md` da raiz do `aion` (não o da pasta pai), na seção `### \`trades\``, trocar:

```
O `risco_retorno` vem **pré-calculado** (`resultado ÷ stop_dolar`) no formulário,
e o usuário pode sobrescrever pelo dropdown.

Fuso horário não é registrado — os horários são anotados no relógio que o usuário
usa. Uma análise futura de "resultado por horário do dia" vai exigir definir isso
antes.
```

por:

```
O `risco_retorno` vem **pré-calculado** (`resultado ÷ stop_dolar`) no formulário,
e o usuário pode sobrescrever pelo dropdown.

Fuso horário não é registrado — os horários são anotados no relógio que o usuário
usa. Uma análise futura de "resultado por horário do dia" vai exigir definir isso
antes.

**Execuções (opcional, só documentação).** Um trade pode ter um log de como a
posição foi montada/desmontada — `execucoes_trade` (`trade_id`, `tipo`:
`Parcial` | `Adição` | `Saída do trade`, `quantidade`, `ordem`, `notas`). É só
registro: não recalcula `contratos`, `resultado` nem nenhum campo calculado
acima. Fecha quando `contratos + soma(Adição) = soma(Parcial) + soma(Saída do
trade)`, exigindo pelo menos uma execução de `Saída do trade`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document execucoes_trade in CLAUDE.md"
```

---

## Task 9: Aplicar a migração e testar de ponta a ponta

**Files:** nenhum arquivo novo — só verificação manual.

**Interfaces:** nenhuma.

- [ ] **Step 1: Aplicar a migração no Supabase**

Este projeto não tem Supabase CLI configurado — toda migração é colada manualmente
no SQL Editor do painel do Supabase (mesmo processo do 0001-0004). **Isto é um
passo manual do usuário**, não algo que rode sozinho: abrir o SQL Editor do
projeto Supabase do AION e colar/rodar o conteúdo inteiro de
`supabase/migracoes/0005_execucoes_trade.sql`.

- [ ] **Step 2: Subir o servidor de desenvolvimento**

Run (em background): `npm run dev` dentro de `aion/`
Expected: log do Next indicando a porta (normalmente `http://localhost:3000`).

- [ ] **Step 3: Roteiro de teste manual**

1. Abrir Perfomance, criar um trade com 3 contratos, marcar "Teve parciais ou
   adições", adicionar uma linha Parcial (2) e uma Saída do trade (1) —
   indicador mostra "✓ soma bate", botão de salvar habilita, salva sem erro.
2. Criar outro trade, marcar o checkbox, deixar só uma linha Parcial (2) sem
   Saída do trade — botão de salvar continua desabilitado; texto mostra
   "inclua uma execução de Saída do trade".
3. Um trade com Adição: entrada 2 contratos, Adição 1, Parcial 2, Saída do
   trade 1 — fecha certo (2+1 = 2+1).
4. Editar um trade com execuções salvas: lista vem pré-populada na ordem
   certa; desmarcar o checkbox e salvar; reabrir a edição — lista veio vazia
   (apagou certo).
5. Na listagem, o trade com execuções mostra o número ao lado de Contratos;
   clicar expande a linha com tipo/quantidade/notas; um trade sem execuções
   não mostra nada.
6. Conferir que `stop_dolar`, `resultado`, `status`, a assertividade e os
   demais cards da Perfomance continuam idênticos a antes da feature — nenhum
   recálculo por causa das execuções.

- [ ] **Step 4: Reportar a URL para o usuário testar**

Não faz commit — este task é só verificação.
