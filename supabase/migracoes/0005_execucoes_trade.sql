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
