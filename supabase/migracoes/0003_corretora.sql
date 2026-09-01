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

do $$ begin
  create type corretora as enum ('Ylos', 'ZeroMarkets', 'B3');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.valores_ponto_corretora (
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
  if tg_op = 'UPDATE'
     and new.conta_id is not distinct from old.conta_id
     and new.ativo is not distinct from old.ativo then
    new.valor_ponto := old.valor_ponto;
    return new;
  end if;

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
  before insert or update on public.trades
  for each row execute function public.definir_valor_ponto_trade();

alter table public.trades drop column stop_dolar;
alter table public.trades drop column resultado_pontos;

alter table public.trades add column stop_dolar numeric(14, 2)
  generated always as (pontos_stop * valor_ponto * contratos) stored;
alter table public.trades add column resultado_pontos numeric(14, 4)
  generated always as (resultado / nullif(valor_ponto * contratos, 0)) stored;

-- valor_do_ponto(ativo) só existia para as generated columns antigas (0001),
-- já substituídas acima. Nada mais chama essa função — remover para não
-- deixar uma segunda fonte de verdade ao lado de valores_ponto_corretora.
drop function public.valor_do_ponto(ativo);
