# Ativos e corretoras por usuário — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada usuário cadastra os próprios ativos (com tick) e corretoras, vincula um ao outro e ajusta os valores sem depender do dono do app.

**Architecture:** Os enums `ativo` e `corretora` viram `text` com chave estrangeira composta `(user_id, codigo|nome)` para dois cadastros novos por usuário (`ativos`, `corretoras`). `valores_ponto_corretora` passa a guardar tick e valor do tick; `valor_ponto` vira coluna gerada. A moeda da conta vem da corretora (trigger). O código do app lê os cadastros do usuário em vez das constantes.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Tailwind, Supabase (Postgres + RLS). Sem suíte de testes: a lógica pura é conferida por scripts `*.check.ts` (`npm run check`, via `tsx`); telas por `tsc`, `lint`, `build` e roteiro manual.

**Spec:** `docs/superpowers/specs/2026-11-20-ativos-e-corretoras-por-usuario-design.md`

## Global Constraints

- Ler o guia relevante em `node_modules/next/dist/docs/` antes de escrever código específico do Next (AGENTS.md: esta versão tem quebras de API).
- Texto da interface em português do Brasil. Nunca exibir chave de tradução crua.
- Todo número na tela usa a classe `num` (JetBrains Mono, `tabular-nums`). Divisão por zero, campo vazio ou inválido mostra `—` (`VAZIO` de `src/lib/formato.ts`), nunca `NaN` nem `0%`.
- Nenhum número derivável é digitado duas vezes: o valor por ponto é calculado do tick; a moeda da conta vem da corretora.
- Dados totalmente separados por `user_id`; RLS "dono" em toda tabela nova, no mesmo molde das existentes (`using (auth.uid() = user_id) with check (auth.uid() = user_id)`).
- `valor_ponto` de um trade continua **congelado** no cadastro (CLAUDE.md, seção 4). Nada nesta mudança pode alterá-lo.
- Códigos de ativo: maiúsculas e dígitos, 1–10 caracteres. Nome de corretora: 1–40 caracteres, único por usuário sem diferenciar caixa.
- Catálogo padrão dos 7 ativos (código · nome · moeda · tamanho do tick · valor do tick · unidade → valor/ponto): MES · S&P · USD · 0,25 · 1,25 · pontos → 5 / MYM · Dow · USD · 1 · 0,50 · pontos → 0,5 / MNQ · Nasdaq · USD · 0,25 · 0,50 · pontos → 2 / MGC · Gold · USD · 0,10 · 1,00 · pontos → 10 / MCL · Oil · USD · 0,01 · 1,00 · % → 100 / MBT · Bitcoin · USD · 5 · 0,50 · pontos → 0,1 / WIN · Mini Índice · BRL · 5 · 1,00 · pontos → 0,2.
- Commits em português, estilo `feat(escopo): …`, terminando com a linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- A migração roda à mão no SQL Editor do Supabase; o agente não tem acesso ao banco. O app antigo continua funcionando depois dela (as colunas viram `text` e `valor_ponto` continua existindo), então cada tarefa de código mantém o build verde.

## Review Focus

1. **Tick digitado com ponto decimal** ("0.25", "1.25") deve valer 0,25 e 1,25 — não 25 e 125. O helper `lerNumero` existente nos `acoes.ts` faz isso errado; o novo não pode. (Teste na Task 1.)
2. **Renomear o código de um ativo não pode recalcular o `valor_ponto` congelado** de trades antigos (o `on update cascade` dispara o trigger de `trades`). (SQL na Task 2; roteiro manual na Task 8.)
3. **Usuário sem corretora, ou corretora sem ativo vinculado:** Conta e Perfomance mostram orientação com link, em vez de formulário vazio que falha ao salvar. (Tasks 6 e 7.)
4. **Código "mes" vs "MES", nome "ylos" vs "Ylos"** são o mesmo cadastro: mensagem amigável, não erro cru do Postgres. (Testes de normalização na Task 1; mapeamento do erro `23505` nas Tasks 4 e 5.)
5. **Remover corretora com contas / ativo com trades, backtestes ou estudos:** nada é apagado e a mensagem explica por quê (`23503`). (Tasks 4 e 5.)

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/contrato.ts` (novo) | Funções puras: ler número, valor por ponto, exemplo de tick, validações e normalização |
| `src/lib/contrato.check.ts` (novo) | Conferência dessas funções |
| `supabase/migracoes/0009_ativos_e_corretoras_por_usuario.sql` (novo) | Schema, backfill, triggers, RPCs, asserções |
| `src/lib/ativos.ts` | Encolhe até só tipos (`Moeda`, `Ativo`, `Corretora`) |
| `src/lib/dados/ativos.ts` (novo) | Leitura dos ativos do usuário |
| `src/lib/dados/corretoras.ts` | Leitura das corretoras e vínculos do usuário |
| `src/components/quadro-tick.tsx` (novo) | Quadro "1 tick = … / 1 ponto = … / Ex.:" ao vivo |
| `src/app/(app)/conta/ativos/{page,formulario,acoes}` (novo) | Tela e ações de Ativos |
| `src/app/(app)/conta/corretoras/{page,tabela,acoes}` | Tela e ações de Corretoras (reformuladas) |
| `src/app/(app)/conta/{page,formulario,acoes}` | Conta usa as corretoras do usuário; moeda deixa de ser campo |
| Perfomance, Backteste, Estudos, Plano | Passam a listar os ativos do usuário |
| `CLAUDE.md` | Seções 3.1, 3.2, 4, 5.1 atualizadas |

---

### Task 1: Funções puras de contrato (tick)

**Files:**
- Create: `src/lib/contrato.ts`, `src/lib/contrato.check.ts`
- Modify: `package.json` (script `check` ganha `&& tsx src/lib/contrato.check.ts`)

**Interfaces:**
- Produces (todas em `src/lib/contrato.ts`):
  - `lerNumero(texto: FormDataEntryValue | string | null | undefined): number | null` — com vírgula, a vírgula é o decimal e os pontos são milhar; sem vírgula, o ponto é o decimal. Vazio, texto ou mais de uma vírgula → `null`.
  - `valorPorPonto(tamanhoTick: number | null, valorTick: number | null): number | null` — `valorTick / tamanhoTick`; `null` se algum for nulo, não finito ou ≤ 0.
  - `type ExemploTick = { ticksPorPonto: number; valorPonto: number; stopPontos: number; stopValor: number }`
  - `exemploDeTick(tamanhoTick: number | null, valorTick: number | null, stopPontos = 10): ExemploTick | null` — `ticksPorPonto = 1 / tamanhoTick`, `stopValor = stopPontos × valorPonto` (1 contrato); resultados arredondados a 8 casas; `null` nas mesmas condições de `valorPorPonto`.
  - `validarEspecificacao(tamanhoTick: number | null, valorTick: number | null, unidade: string): string | null` — mensagem de erro ou `null`. Textos: "Informe o tamanho do tick (maior que zero).", "Informe o valor do tick (maior que zero).", "Escolha a unidade do stop." (unidade válida = `UNIDADES` de `src/lib/opcoes.ts`).
  - `normalizarCodigoAtivo(texto: string): string | null` — trim + maiúsculas; `null` se não casar `^[A-Z0-9]{1,10}$`.
  - `normalizarNomeCorretora(texto: string): string | null` — trim + espaços internos colapsados; `null` se vazio ou > 40 caracteres.

- [ ] **Step 1: Escrever `contrato.check.ts` (falhando)** no molde de `metricas.check.ts` (função `eq`, contador de falhas, `process.exit(1)` se houver). Casos:
  - `lerNumero`: `"0.25"→0.25`, `"0,25"→0.25`, `"1.250,5"→1250.5`, `" 5 "→5`, `""→null`, `null→null`, `"abc"→null`, `"1,2,3"→null`.
  - `valorPorPonto`: `(0.25,1.25)→5`, `(0.1,1)→10`, `(5,1)→0.2`, `(5,0.5)→0.1`, `(0.01,1)→100`; `(0,1)`, `(1,0)`, `(null,1)`, `(-1,1)` → `null`.
  - `exemploDeTick(0.1, 1)` → `{ticksPorPonto:10, valorPonto:10, stopPontos:10, stopValor:100}`; `exemploDeTick(0.25, 1.25, 4)` → `{ticksPorPonto:4, valorPonto:5, stopPontos:4, stopValor:20}`; `exemploDeTick(0, 1)` → `null`.
  - `validarEspecificacao(0.1, 1, "pontos")→null`; com tick `null` → mensagem do tick; unidade `"x"` → mensagem da unidade.
  - `normalizarCodigoAtivo`: `" mes "→"MES"`, `"mnq2"→"MNQ2"`, `"M-ES"→null`, `""→null`, `"ABCDEFGHIJK"→null`.
  - `normalizarNomeCorretora`: `"  Zero   Markets "→"Zero Markets"`, `""→null`, 41 caracteres → `null`.
- [ ] **Step 2: Rodar e ver falhar** — `npx tsx src/lib/contrato.check.ts` → erro de módulo inexistente.
- [ ] **Step 3: Implementar `src/lib/contrato.ts`** conforme as assinaturas acima (sem dependências além de `UNIDADES`).
- [ ] **Step 4: Rodar e ver passar** — `npx tsx src/lib/contrato.check.ts` → todas as linhas `ok`; depois `npm run check` → exit 0.
- [ ] **Step 5: Commit**

```bash
git add src/lib/contrato.ts src/lib/contrato.check.ts package.json docs/superpowers/specs/2026-11-20-ativos-e-corretoras-por-usuario-design.md docs/superpowers/plans/2026-11-20-ativos-e-corretoras-por-usuario.md
git commit -m "feat(contrato): funções puras de tick, leitura de número e validações"
```

---

### Task 2: Migração `0009`

**Files:**
- Create: `supabase/migracoes/0009_ativos_e_corretoras_por_usuario.sql`

**Interfaces:**
- Produces (schema que as demais tarefas consomem):
  - `public.ativos(id, user_id, created_at, codigo text, nome text, moeda moeda_conta, tamanho_tick numeric, valor_tick numeric, unidade text, valor_ponto numeric generated)`; `unique (user_id, codigo)`; check de código `^[A-Z0-9]{1,10}$`, ticks > 0, unidade ∈ (`pontos`,`dólares`,`%`).
  - `public.corretoras(id, user_id, created_at, nome text, moeda moeda_conta)`; `unique (user_id, nome)` **e** `unique index (user_id, lower(nome))`.
  - `valores_ponto_corretora`: `corretora`, `ativo` → `text` com FK composta; novas colunas `tamanho_tick`, `valor_tick`; `valor_ponto` gerada.
  - `contas.corretora text` com FK `on update cascade on delete restrict`; `contas.moeda` preenchida por trigger a partir da corretora.
  - RPCs (security invoker): `criar_corretora(p_nome text, p_moeda moeda_conta, p_ativos text[]) returns void`, `vincular_ativo(p_corretora text, p_ativo text) returns void`, `voltar_ao_padrao(p_corretora text, p_ativo text) returns void`. Copiam tick, valor do tick e unidade da linha de `ativos`.
  - Erros de negócio levantados pelo banco: mensagem `corretora_com_contas` (trocar moeda de corretora que tem contas) e `corretora_inexistente` (conta apontando para corretora que não existe).

- [ ] **Step 1: Cabeçalho e transação.** Comentário no estilo das migrações anteriores (o que faz, como rodar). Tudo entre `begin;` e `commit;`; não há `ALTER TYPE … ADD VALUE`, então roda inteiro de uma vez.
- [ ] **Step 2: Foto "antes".** Tabelas temporárias com `(user_id, corretora::text, ativo::text, valor_ponto)` de `valores_ponto_corretora`, `(id, valor_ponto)` de `trades` e as contagens por usuário de `trades`, `backtestes`, `estudos`.
- [ ] **Step 3: Criar `ativos` e `corretoras`** (colunas e checagens acima, RLS "dono" no molde de `0003_corretora.sql`).
- [ ] **Step 4: Catálogo e backfill.** Função `public.semear_ativos_padrao(p_user uuid)` que insere os 7 ativos do catálogo (`on conflict do nothing`). Rodar para cada linha de `auth.users`. Criar `corretoras` com os nomes distintos vindos de `valores_ponto_corretora` e de `contas` (moeda `BRL` se o nome for `B3`, senão `USD`).
- [ ] **Step 5: Trigger para usuário novo.** `public.semear_ativos_novo_usuario()` (`security definer`, `set search_path = public`) chama `semear_ativos_padrao(new.id)`; trigger `after insert on auth.users`.
- [ ] **Step 6: Converter colunas.** Para cada uma, `drop default` quando houver, `alter column … type text using …::text` (para `plano.ativos`: `text[] using ativos::text[]`, depois `set default '{}'`): `backtestes.ativo`, `trades.ativo`, `estudos.ativo`, `plano.ativos`, `valores_ponto_corretora.ativo` e `.corretora`, `contas.corretora` (sem default novo).
- [ ] **Step 7: Tick nos vínculos.** Adicionar `tamanho_tick` e `valor_tick` anuláveis; preencher `tamanho_tick` com o tick do ativo do mesmo usuário e `valor_tick = valor_ponto × tamanho_tick`; trocar a `valor_ponto` antiga por coluna gerada `valor_tick / tamanho_tick`; `not null` + check `> 0` nas duas novas.
- [ ] **Step 8: Chaves estrangeiras.** `valores_ponto_corretora (user_id, corretora)` → `corretoras (user_id, nome)` e `(user_id, ativo)` → `ativos (user_id, codigo)`, ambas `on update cascade on delete cascade`. `contas (user_id, corretora)` → `corretoras` `on update cascade on delete restrict`. `trades`, `backtestes`, `estudos` `(user_id, ativo)` → `ativos` `on update cascade on delete restrict`.
- [ ] **Step 9: Triggers de regra.**
  - `contas` `before insert or update`: `select moeda into new.moeda from public.corretoras where user_id = new.user_id and nome = new.corretora`; se `not found`, `raise exception 'corretora_inexistente'`.
  - `corretoras` `before update of moeda`: se a moeda mudou e existe conta com `corretora = old.nome` do mesmo usuário, `raise exception 'corretora_com_contas'`.
  - `ativos` `after update of codigo` → `update plano set ativos = array_replace(ativos, old.codigo, new.codigo) where user_id = new.user_id`; `after delete` → `array_remove`.
  - Substituir `definir_valor_ponto_trade()` (variável `corretora_da_conta` passa a `text`) com a regra de renomeação abaixo.
- [ ] **Step 10: RPCs** `criar_corretora`, `vincular_ativo`, `voltar_ao_padrao` (assinaturas acima; `criar_corretora` insere a corretora e um vínculo por ativo de `p_ativos` que exista em `ativos` do usuário, tudo na mesma chamada).
- [ ] **Step 11: Remover os enums.** `drop type ativo; drop type corretora;`
- [ ] **Step 12: Asserções finais.** Bloco `do $$` que levanta exceção (desfazendo tudo) se: algum `valor_ponto` de vínculo diferir da foto "antes" (`is distinct from`); algum `trades.valor_ponto` diferir; as contagens de `trades`/`backtestes`/`estudos` por usuário diferirem; algum usuário ficar sem os 7 ativos.
- [ ] **Step 13: Entregar ao usuário.** Pedir backup (Supabase → Database → Backups), perguntar em qual projeto rodar e colar o arquivo inteiro no SQL Editor. Resultado esperado: sem erro; `select count(*) from ativos` = 7 × número de usuários. Só prosseguir para a Task 3 com a migração aplicada.
- [ ] **Step 14: Commit**

```bash
git add supabase/migracoes/0009_ativos_e_corretoras_por_usuario.sql
git commit -m "feat(banco): ativos e corretoras por usuário, tick e valor por ponto gerado"
```

Regra de renomeação no trigger de `trades` (o cascade de `ativos.codigo` não pode refazer o snapshot):

```sql
create or replace function public.definir_valor_ponto_trade()
returns trigger language plpgsql as $$
declare
  corretora_da_conta text;
  vp numeric;
begin
  if tg_op = 'UPDATE' and new.conta_id is not distinct from old.conta_id then
    if new.ativo is not distinct from old.ativo then
      new.valor_ponto := old.valor_ponto; return new;
    end if;
    -- código renomeado em cascata: o antigo já não existe no cadastro
    if not exists (select 1 from public.ativos a where a.user_id = new.user_id and a.codigo = old.ativo) then
      new.valor_ponto := old.valor_ponto; return new;
    end if;
  end if;
  select corretora into corretora_da_conta from public.contas where id = new.conta_id;
  select valor_ponto into vp from public.valores_ponto_corretora
    where user_id = new.user_id and corretora = corretora_da_conta and ativo = new.ativo;
  if vp is null then
    raise exception 'Valor por ponto não cadastrado para % / %', corretora_da_conta, new.ativo;
  end if;
  new.valor_ponto := vp; return new;
end $$;
```

---

### Task 3: Tipos e camada de dados (aditiva)

**Files:**
- Modify: `src/lib/ativos.ts`, `src/lib/dados/corretoras.ts`, `src/lib/dados/contas.ts`, `src/lib/dados/trades.ts`
- Create: `src/lib/dados/ativos.ts`

**Interfaces:**
- Consumes: schema da Task 2.
- Produces:
  - `src/lib/ativos.ts`: `type Moeda = "USD" | "BRL"`, `type Ativo = string`, `type Corretora = string` (as constantes `ATIVOS`, `CORRETORAS`, `corretorasPorMoeda`, `moedaDoAtivo` ficam por enquanto, para as telas antigas compilarem; saem nas Tasks 6 e 7).
  - `src/lib/dados/ativos.ts`: `type AtivoCadastrado = { id: string; codigo: string; nome: string; moeda: Moeda; tamanhoTick: number; valorTick: number; valorPonto: number; unidade: string }` e `listarAtivos(): Promise<AtivoCadastrado[]>` (ordem alfabética de `codigo`).
  - `src/lib/dados/corretoras.ts`: `type CorretoraCadastrada = { id: string; nome: string; moeda: Moeda; contas: number; vinculos: VinculoAtivo[] }`, `type VinculoAtivo = { ativo: string; nome: string; tamanhoTick: number; valorTick: number; valorPonto: number; unidade: string; moedaDoPadrao: Moeda; difereDoPadrao: boolean }`, `listarCorretorasDoUsuario(): Promise<CorretoraCadastrada[]>` (alfabética; `contas` = quantas contas usam; `difereDoPadrao` = tick, valor do tick ou unidade diferentes do ativo). `especificacoesDaCorretora` continua igual.

- [ ] **Step 1: Ajustar tipos** em `ativos.ts` e remover os fallbacks `?? "Ylos"` de `contas.ts` e `trades.ts` (a corretora agora é obrigatória na conta).
- [ ] **Step 2: Implementar `listarAtivos` e `listarCorretorasDoUsuario`** (duas consultas e junção em memória, como `listarContas` faz).
- [ ] **Step 3: Verificar** — `npx tsc --noEmit` e `npm run lint` sem erros novos.
- [ ] **Step 4: Commit**

```bash
git add src/lib
git commit -m "feat(dados): leitura de ativos e corretoras cadastrados pelo usuário"
```

---

### Task 4: Tela de Ativos e quadro de exemplo

**Files:**
- Create: `src/components/quadro-tick.tsx`, `src/app/(app)/conta/ativos/page.tsx`, `src/app/(app)/conta/ativos/formulario.tsx`, `src/app/(app)/conta/ativos/acoes.ts`
- Modify: `src/app/(app)/conta/page.tsx` (cabeçalho ganha o link "Ativos →" ao lado de "Corretoras →")

**Interfaces:**
- Consumes: `listarAtivos`; `lerNumero`, `exemploDeTick`, `validarEspecificacao`, `normalizarCodigoAtivo`; `moeda`/`VAZIO` de `src/lib/formato.ts`.
- Produces:
  - `QuadroTick({ tamanhoTick, valorTick, unidade, moeda }: { tamanhoTick: string; valorTick: string; unidade: string; moeda: Moeda })` — componente de cliente que recebe os textos digitados, usa `lerNumero` + `exemploDeTick` e mostra as três linhas do design (`1 tick = … = $…` / `1 ponto = … ticks = $…` / `Ex.: stop de 10 pontos × 1 contrato = $…`); com valor inválido mostra `—` nos números. Reutilizado na Task 5.
  - `salvarAtivo(_anterior: EstadoAtivo, dados: FormData): Promise<EstadoAtivo>` com `EstadoAtivo = { erro?: string }`; campos `id` (vazio = criar), `codigo`, `nome`, `moeda`, `tamanho_tick`, `valor_tick`, `unidade`. Sucesso → `revalidatePath("/conta/ativos")` e `redirect("/conta/ativos")`.
  - `removerAtivo(dados: FormData): Promise<void>` — campo `id`.

- [ ] **Step 1: `QuadroTick`** conforme acima, no visual de card/poço da identidade (seção 7 do CLAUDE.md).
- [ ] **Step 2: `salvarAtivo`.** Normaliza o código, valida com `validarEspecificacao` e exige `nome` e `moeda` ∈ (`USD`,`BRL`). Erro Postgres `23505` → "Você já tem um ativo com esse código." (cobre "mes" vs "MES", porque o código é normalizado antes). Código inválido → "Use de 1 a 10 letras ou números no código."
- [ ] **Step 3: `removerAtivo`.** Erro `23503` → `redirect("/conta/ativos?erro=" + encodeURIComponent("Esse ativo tem registros e não pode ser removido."))`, mesmo padrão de `removerConta`; usar `BotaoRemover`.
- [ ] **Step 4: Página e formulário.** Lista (código, nome, moeda do padrão, tick, valor do tick, valor por ponto, unidade, Editar, Remover) e formulário "Novo ativo"/"Editar ativo" ao lado, no layout de `conta/page.tsx`, com `QuadroTick` abaixo dos campos e a nota "Editar o padrão não altera corretoras já vinculadas." `searchParams` com `?editar=<id>` e `?erro=`.
- [ ] **Step 5: Verificar** — `npx tsc --noEmit`, `npm run lint`. Manual (com a migração aplicada): `/conta/ativos` lista os 7 ativos com os valores do catálogo; criar "mes" → erro de duplicado; criar "NQ", tick `0.25`, valor `5` → quadro mostra ponto = 20; remover um ativo sem registros funciona; remover MES (que tem trades) mostra a mensagem e nada some.
- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat(ativos): tela de cadastro de ativos com tick e exemplo ao vivo"
```

---

### Task 5: Tela de Corretoras reformulada

**Files:**
- Modify: `src/app/(app)/conta/corretoras/page.tsx`, `tabela.tsx`, `acoes.ts`

**Interfaces:**
- Consumes: `listarCorretorasDoUsuario`, `listarAtivos`, `QuadroTick`, RPCs `criar_corretora` / `vincular_ativo` / `voltar_ao_padrao`.
- Produces (Server Actions em `acoes.ts`, estado `{ erro?: string; ok?: boolean }`):
  - `criarCorretora(_anterior, dados: FormData)` — campos `nome`, `moeda`, `ativos` (vários). Chama `rpc("criar_corretora", { p_nome, p_moeda, p_ativos })`.
  - `editarCorretora(_anterior, dados)` — `id`, `nome`, `moeda`; update em `corretoras`.
  - `removerCorretora(dados: FormData): Promise<void>` — `id`.
  - `vincularAtivo(_anterior, dados)` — `corretora`, `ativo` → `rpc("vincular_ativo", …)`.
  - `voltarAoPadrao(dados: FormData): Promise<void>` — `corretora`, `ativo` → `rpc("voltar_ao_padrao", …)`.
  - `desvincularAtivo(dados: FormData): Promise<void>` — delete em `valores_ponto_corretora`.
  - `atualizarEspecificacao` (existente) passa a ler `tamanho_tick`, `valor_tick`, `unidade` (via `lerNumero` e `validarEspecificacao`) em vez de `valor_ponto`.

- [ ] **Step 1: Ações.** Mapear erros: `23505` → "Você já tem uma corretora com esse nome."; `23503` ao remover → "Essa corretora tem contas e não pode ser removida."; mensagem `corretora_com_contas` ao trocar a moeda → "Essa corretora tem contas — a moeda não pode mudar." Nome passa por `normalizarNomeCorretora`.
- [ ] **Step 2: Página.** Botão "Nova corretora" (nome, moeda, caixas dos ativos do usuário, todas marcadas por padrão) e um card por corretora com nome + moeda, Renomear/Editar, Remover (`BotaoRemover`) e a tabela de vínculos. Sem corretoras: estado vazio explicando o primeiro passo.
- [ ] **Step 3: Tabela de vínculos.** Colunas: ativo, tick, valor do tick, valor por ponto (calculado, `num`), unidade, ações. Editar inline (mesmo padrão "clica, edita, confirma" de hoje) com tick, valor do tick e unidade e o `QuadroTick` abaixo da linha; "Voltar ao padrão" visível só quando `difereDoPadrao`; "Desvincular"; "Vincular ativo" listando só os ainda não vinculados. Quando `moedaDoPadrao` ≠ moeda da corretora, a linha mostra "Valores padrão do {código} estão em {R$|US$} — confira para a moeda desta corretora."
- [ ] **Step 4: Verificar** — `npx tsc --noEmit`, `npm run lint`. Manual: as 5 corretoras antigas aparecem com os mesmos valores por ponto de antes (ZeroMarkets MES = 1; Ylos MGC = 10; B3 WIN = 0,2); criar "XP" em USD com MGC e WIN → WIN mostra o aviso de moeda; editar o tick de um vínculo e "Voltar ao padrão"; renomear "XP" → "xp" é aceito (mesma pessoa), criar "ylos" com a Ylos existente → mensagem de duplicado; remover uma corretora com conta → mensagem e nada some.
- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(corretoras): cadastro por usuário com vínculo de ativos, tick e voltar ao padrão"
```

---

### Task 6: Conta usa as corretoras do usuário

**Files:**
- Modify: `src/app/(app)/conta/page.tsx`, `formulario.tsx`, `acoes.ts`, `src/lib/ativos.ts` (remove `CORRETORAS` e `corretorasPorMoeda`)

**Interfaces:**
- Consumes: `listarCorretorasDoUsuario`.
- Produces: `FormularioConta({ conta, corretoras }: { conta: Conta | null; corretoras: CorretoraCadastrada[] })`; `salvarConta` deixa de ler o campo `moeda` (o banco a define pela corretora) e valida só que `corretora` veio preenchida.

- [ ] **Step 1: Formulário.** Some o seletor de moeda; o seletor de corretora lista `corretoras` com a moeda ao lado ("Ylos · US$"); os rótulos "Saldo inicial (USD)", "Meta (USD)", "MLPT", "MLPD" usam a moeda da corretora escolhida. Sem nenhuma corretora: no lugar do botão Criar, o aviso "Cadastre uma corretora primeiro" com link para `/conta/corretoras`.
- [ ] **Step 2: `salvarConta`** sem `moeda` no payload; erro do banco `corretora_inexistente` → "Escolha uma corretora da sua lista."
- [ ] **Step 3: Remover** `CORRETORAS` e `corretorasPorMoeda` de `src/lib/ativos.ts`.
- [ ] **Step 4: Verificar** — `npx tsc --noEmit`, `npm run lint`. Manual: criar conta em corretora USD e em corretora BRL (a moeda exibida acompanha); com um usuário de teste sem corretoras, o aviso aparece.
- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(conta): corretora escolhida da lista do usuário; moeda vem da corretora"
```

---

### Task 7: Telas passam a usar os ativos do usuário

**Files:**
- Modify: `src/app/(app)/perfomance/formulario-trade.tsx` e `page.tsx`, `src/app/(app)/backteste/[tempo]/page.tsx` e `tabela.tsx`, `src/lib/dados/contas.ts` (`contaPadraoParaBackteste` devolve também `moeda: Moeda | null`), `src/app/(app)/estudos/formulario.tsx` e `page.tsx`, `src/app/(app)/plano/editar/formulario.tsx` e `page.tsx`, `src/lib/ativos.ts` (remove `ATIVOS`, `ativo()`, `moedaDoAtivo`), `src/lib/metricas.check.ts` (remove o import e as duas linhas de `moedaDoAtivo`)

**Interfaces:**
- Consumes: `listarAtivos`, `especificacoesDaCorretora`.
- Produces: cada tela recebe `ativos: AtivoCadastrado[]` (ou `{codigo, nome}[]`) por prop.

- [ ] **Step 1: Perfomance.** `ativosPermitidos` = ativos vinculados à corretora da conta (as chaves de `especificacoes`) mais o ativo do próprio trade na edição, sem filtrar por moeda. Corretora sem nenhum vínculo: o formulário mostra "Esta corretora não tem ativos — vincule em Corretoras" com link, em vez de abrir vazio.
- [ ] **Step 2: Backteste.** Filtro por ativo e seletor da linha de cadastro listam `listarAtivos()`. `ValorStopDolar` usa a moeda da conta padrão (`contaPadraoParaBackteste().moeda`, padrão `"USD"` se não houver conta) para símbolo e valor, e deixa de consultar `ATIVOS`.
- [ ] **Step 3: Estudos.** Chips de ativo vêm de `listarAtivos()`; o padrão selecionado é o primeiro da lista (não mais `"MNQ"`). Sem ativos: aviso com link para `/conta/ativos`.
- [ ] **Step 4: Plano (editar).** Chips de "Ativos autorizados" vêm de `listarAtivos()`.
- [ ] **Step 5: Remover as constantes** `ATIVOS`, `ativo()` e `moedaDoAtivo` de `src/lib/ativos.ts` (o arquivo fica só com os tipos) e ajustar `metricas.check.ts`.
- [ ] **Step 6: Verificar** — `npx tsc --noEmit`, `npm run lint`, `npm run check`, `npm run build`. Manual: registrar um trade na conta da Ylos e na da ZeroMarkets e conferir "Stop $" e pontos como antes; Backteste e Estudos listam os ativos do usuário; ativo novo (Task 4) aparece em Estudos e Plano.
- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat(ativos): Perfomance, Backteste, Estudos e Plano listam os ativos do usuário"
```

---

### Task 8: Documentação e verificação final

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Atualizar `CLAUDE.md`.** Seção 3.1: remover as linhas dos enums `ativo`. Seção 3.2: a tabela de 7 ativos vira "catálogo padrão que cada usuário recebe", explicando tick, valor do tick e que moeda, nome, código e unidade são editáveis. Seção 4: `contas` (`corretora` é texto ligado a `corretoras`; `moeda` vem da corretora), novas tabelas `ativos` e `corretoras`, `valores_ponto_corretora` com tick e `valor_ponto` gerado, regra do trigger de trades com a renomeação. Seção 5.1: telas Ativos e Corretoras novas. Remover a frase da seção 4 que diz que a cobertura "não é uma regra fixa em código" só se ficar redundante.
- [ ] **Step 2: Verificação completa** — `npm run check`, `npm run lint`, `npm run build` sem erros.
- [ ] **Step 3: Roteiro manual de fechamento** (com a migração aplicada):
  1. Os trades existentes mostram o mesmo "Stop $", pontos e saldo de antes.
  2. **Renomear código de ativo:** em Ativos, mudar um código sem uso real (ou criar "TST", registrar um trade nele e renomear para "TST2"); o trade mantém o mesmo valor por ponto e o mesmo Stop $, e o chip em Plano e o filtro do Backteste mostram o novo código.
  3. Mudar o valor do tick de um vínculo **não** altera trades já salvos; um trade novo usa o valor novo.
  4. Criar usuário novo no painel do Supabase: já tem os 7 ativos e nenhuma corretora; criar corretora → conta → trade funciona de ponta a ponta.
  5. Dois usuários distintos não veem ativos nem corretoras um do outro.
- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: especificação com ativos e corretoras cadastrados por usuário"
```
