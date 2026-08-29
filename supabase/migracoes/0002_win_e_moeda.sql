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
alter type ativo add value if not exists 'WIN';

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

do $$ begin
  create type moeda_conta as enum ('USD', 'BRL');
exception
  when duplicate_object then null;
end $$;

alter table public.contas
  add column if not exists moeda moeda_conta not null default 'USD';
