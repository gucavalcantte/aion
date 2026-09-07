-- =============================================================================
-- AION — Contratos fracionados
-- Cole inteiro no SQL Editor do Supabase e rode de uma vez.
--
-- `contratos` (trades) e `quantidade` (execucoes_trade) eram `integer`,
-- pensados quando só existiam corretoras que operam lote inteiro. A Zero
-- Markets permite lote fracionado (ex.: 0,4 contrato), que o tipo inteiro não
-- representa. Os dois viram `numeric(10,2)` — duas casas cobre a granularidade
-- de lote fracionado sem abrir espaço para arredondamento maluco.
--
-- stop_dolar e resultado_pontos dependem de contratos numa generated column;
-- precisam ser derrubadas e recriadas em volta do ALTER COLUMN TYPE, mesmo
-- padrão do 0003_corretora.sql.
-- =============================================================================

alter table public.trades drop column stop_dolar;
alter table public.trades drop column resultado_pontos;

alter table public.trades
  alter column contratos type numeric(10, 2) using contratos::numeric;

alter table public.trades add column stop_dolar numeric(14, 2)
  generated always as (pontos_stop * valor_ponto * contratos) stored;
alter table public.trades add column resultado_pontos numeric(14, 4)
  generated always as (resultado / nullif(valor_ponto * contratos, 0)) stored;

alter table public.execucoes_trade
  alter column quantidade type numeric(10, 2) using quantidade::numeric;
