-- =============================================================================
-- AION — tipo de entrada no trade (Confirmada / Antecipada)
--
-- Cole inteiro no SQL Editor do Supabase e rode de uma vez. Diferente do 0002,
-- este arquivo NÃO cria valor de enum novo — reusa o tipo `entrada` que o 0001
-- já criou para os backtestes —, então não há o problema de "unsafe use of new
-- value of enum type" e uma etapa só basta.
--
-- A coluna é NULLABLE de propósito, apesar de o formulário exigir o campo.
-- Os trades já gravados não têm essa informação, e carimbá-los com
-- 'Confirmada' inventaria estatística que ninguém observou. Eles aparecem
-- como "—" na tabela até serem editados à mão.
-- =============================================================================

alter table public.trades
  add column if not exists entrada entrada;
