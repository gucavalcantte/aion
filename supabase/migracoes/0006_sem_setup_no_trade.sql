-- =============================================================================
-- AION — "Sem setup" no trade
--
-- Cole inteiro no SQL Editor do Supabase e rode de uma vez.
--
-- Até aqui todo trade precisava de um setup. Na prática, às vezes se opera
-- fora de qualquer setup estudado — e isso é justamente o tipo de trade que
-- mais importa registrar como fora do plano, não deixar de fora do app.
--
-- `setup_id` passa a aceitar nulo: nulo = "Sem setup", escolhido de
-- propósito pelo usuário no formulário (não é dado faltando, como
-- `entrada` era no 0004 — lá o nulo vinha de trades antigos; aqui o nulo é
-- uma opção ativa). O formulário grava nulo através da sentinela "Sem
-- setup", nunca deixando o campo vazio.
--
-- Continua com "on delete restrict": apagar um setup que tem trade
-- vinculado ainda é bloqueado — só passa a ser possível marcar o trade como
-- sem setup manualmente, não apagar o setup por baixo dele.
-- =============================================================================

alter table public.trades
  alter column setup_id drop not null;
