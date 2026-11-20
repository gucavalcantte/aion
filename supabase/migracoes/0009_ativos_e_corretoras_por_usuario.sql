-- =============================================================================
-- AION — Ativos e corretoras cadastrados por usuário
--
-- Os enums `ativo` e `corretora` viram texto, ligados a dois cadastros novos
-- por usuário (`ativos` e `corretoras`). `valores_ponto_corretora` passa a
-- guardar tamanho e valor do tick, e `valor_ponto` vira coluna GERADA
-- (valor_tick / tamanho_tick). A moeda da conta passa a vir da corretora.
-- Ver docs/superpowers/specs/2026-11-20-ativos-e-corretoras-por-usuario-design.md
--
-- COMO RODAR: faça um backup antes (Supabase → Database → Backups), cole o
-- arquivo INTEIRO no SQL Editor e rode de uma vez. Não há ALTER TYPE ... ADD
-- VALUE, então não precisa de etapas. Tudo roda numa transação: o bloco de
-- asserções no fim desfaz TUDO se algum valor por ponto, trade ou conta
-- mudou durante a migração.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Foto "antes", para as asserções do fim
-- -----------------------------------------------------------------------------

create temp table _vpc_antes on commit drop as
  select user_id, corretora::text as corretora, ativo::text as ativo, valor_ponto
  from public.valores_ponto_corretora;

create temp table _trades_antes on commit drop as
  select id, valor_ponto from public.trades;

create temp table _contas_antes on commit drop as
  select id, moeda from public.contas;

create temp table _contagens_antes on commit drop as
  select u.id as user_id,
    (select count(*) from public.trades t where t.user_id = u.id) as trades,
    (select count(*) from public.backtestes b where b.user_id = u.id) as backtestes,
    (select count(*) from public.estudos e where e.user_id = u.id) as estudos
  from auth.users u;

-- -----------------------------------------------------------------------------
-- 2. Cadastros novos: ativos e corretoras (por usuário, RLS "dono")
-- -----------------------------------------------------------------------------

create table public.ativos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  codigo       text not null,
  nome         text not null,
  -- moeda em que estão os valores PADRÃO; não restringe em que corretora o ativo é usado
  moeda        moeda_conta not null,
  tamanho_tick numeric not null,
  valor_tick   numeric not null,
  unidade      text not null, -- 'pontos' | 'dólares' | '%'
  valor_ponto  numeric generated always as (valor_tick / tamanho_tick) stored,

  constraint ativos_codigo_valido check (codigo ~ '^[A-Z0-9]{1,10}$'),
  constraint ativos_tick_positivo check (tamanho_tick > 0 and valor_tick > 0),
  constraint ativos_unidade_valida check (unidade in ('pontos', 'dólares', '%')),
  unique (user_id, codigo)
);

alter table public.ativos enable row level security;
create policy "dono" on public.ativos
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.corretoras (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  nome  text not null,
  -- moeda em que os valores dos ativos vinculados são lidos; é a moeda das contas
  moeda moeda_conta not null,

  constraint corretoras_nome_valido check (char_length(nome) between 1 and 40 and nome = btrim(nome)),
  unique (user_id, nome)
);

-- "ylos" e "Ylos" são a mesma corretora
create unique index corretoras_nome_sem_caixa on public.corretoras (user_id, lower(nome));

alter table public.corretoras enable row level security;
create policy "dono" on public.corretoras
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. Catálogo padrão dos 7 ativos — fonte única: migração e usuário novo
-- -----------------------------------------------------------------------------

create or replace function public.semear_ativos_padrao(p_user uuid)
returns void
language sql
as $$
  insert into public.ativos (user_id, codigo, nome, moeda, tamanho_tick, valor_tick, unidade)
  values
    (p_user, 'MES', 'S&P',         'USD', 0.25, 1.25, 'pontos'),
    (p_user, 'MYM', 'Dow',         'USD', 1,    0.50, 'pontos'),
    (p_user, 'MNQ', 'Nasdaq',      'USD', 0.25, 0.50, 'pontos'),
    (p_user, 'MGC', 'Gold',        'USD', 0.10, 1.00, 'pontos'),
    (p_user, 'MCL', 'Oil',         'USD', 0.01, 1.00, '%'),
    (p_user, 'MBT', 'Bitcoin',     'USD', 5,    0.50, 'pontos'),
    (p_user, 'WIN', 'Mini Índice', 'BRL', 5,    1.00, 'pontos')
  on conflict (user_id, codigo) do nothing;
$$;

revoke all on function public.semear_ativos_padrao(uuid) from public, anon, authenticated;

-- Usuários que já existem
select public.semear_ativos_padrao(id) from auth.users;

-- Usuário novo já nasce com os 7 ativos (e sem corretoras: ele cria as dele)
create or replace function public.semear_ativos_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.semear_ativos_padrao(new.id);
  return new;
end;
$$;

revoke all on function public.semear_ativos_novo_usuario() from public, anon, authenticated;

create trigger trg_semear_ativos_novo_usuario
  after insert on auth.users
  for each row execute function public.semear_ativos_novo_usuario();

-- -----------------------------------------------------------------------------
-- 4. Corretoras que cada usuário já usa (B3 é BRL; as demais, USD — a regra antiga)
-- -----------------------------------------------------------------------------

insert into public.corretoras (user_id, nome, moeda)
select distinct x.user_id, x.corretora,
  case when x.corretora = 'B3' then 'BRL'::moeda_conta else 'USD'::moeda_conta end
from (
  select user_id, corretora::text as corretora from public.valores_ponto_corretora
  union
  select user_id, corretora::text as corretora from public.contas
) x;

-- -----------------------------------------------------------------------------
-- 5. Enums viram texto
-- -----------------------------------------------------------------------------

alter table public.backtestes alter column ativo type text using ativo::text;
alter table public.trades     alter column ativo type text using ativo::text;
alter table public.estudos    alter column ativo type text using ativo::text;

alter table public.plano alter column ativos drop default;
alter table public.plano alter column ativos type text[] using ativos::text[];
alter table public.plano alter column ativos set default '{}';

alter table public.contas alter column corretora drop default;
alter table public.contas alter column corretora type text using corretora::text;

alter table public.valores_ponto_corretora
  alter column corretora type text using corretora::text,
  alter column ativo type text using ativo::text;

-- -----------------------------------------------------------------------------
-- 6. Tick nos vínculos; valor_ponto passa a ser gerado.
--    O tick vem do ativo e o valor do tick preserva EXATAMENTE o valor por
--    ponto de hoje (valor_tick = valor_ponto × tamanho_tick).
-- -----------------------------------------------------------------------------

alter table public.valores_ponto_corretora
  add column tamanho_tick numeric,
  add column valor_tick numeric;

update public.valores_ponto_corretora v
set tamanho_tick = a.tamanho_tick,
    valor_tick = v.valor_ponto * a.tamanho_tick
from public.ativos a
where a.user_id = v.user_id and a.codigo = v.ativo;

alter table public.valores_ponto_corretora drop column valor_ponto;

alter table public.valores_ponto_corretora
  add column valor_ponto numeric generated always as (valor_tick / tamanho_tick) stored;

alter table public.valores_ponto_corretora
  alter column tamanho_tick set not null,
  alter column valor_tick set not null,
  add constraint valores_ponto_corretora_tick_positivo check (tamanho_tick > 0 and valor_tick > 0);

-- -----------------------------------------------------------------------------
-- 7. Chaves estrangeiras compostas (user_id, código|nome)
-- -----------------------------------------------------------------------------

alter table public.valores_ponto_corretora
  add constraint valores_ponto_corretora_corretora_fk
    foreign key (user_id, corretora) references public.corretoras (user_id, nome)
    on update cascade on delete cascade,
  add constraint valores_ponto_corretora_ativo_fk
    foreign key (user_id, ativo) references public.ativos (user_id, codigo)
    on update cascade on delete cascade;

alter table public.contas
  add constraint contas_corretora_fk
    foreign key (user_id, corretora) references public.corretoras (user_id, nome)
    on update cascade on delete restrict;

alter table public.trades
  add constraint trades_ativo_fk
    foreign key (user_id, ativo) references public.ativos (user_id, codigo)
    on update cascade on delete restrict;

alter table public.backtestes
  add constraint backtestes_ativo_fk
    foreign key (user_id, ativo) references public.ativos (user_id, codigo)
    on update cascade on delete restrict;

alter table public.estudos
  add constraint estudos_ativo_fk
    foreign key (user_id, ativo) references public.ativos (user_id, codigo)
    on update cascade on delete restrict;

-- -----------------------------------------------------------------------------
-- 8. Regras no banco
-- -----------------------------------------------------------------------------

-- A moeda da conta é SEMPRE a da corretora (nunca digitada duas vezes).
create or replace function public.definir_moeda_da_conta()
returns trigger
language plpgsql
as $$
begin
  select moeda into new.moeda
  from public.corretoras
  where user_id = new.user_id and nome = new.corretora;

  if not found then
    raise exception 'corretora_inexistente';
  end if;
  return new;
end;
$$;

create trigger trg_moeda_da_conta
  before insert or update on public.contas
  for each row execute function public.definir_moeda_da_conta();

-- Corretora com contas não pode mudar de moeda (reinterpretaria saldos e trades).
create or replace function public.proteger_moeda_da_corretora()
returns trigger
language plpgsql
as $$
begin
  if new.moeda is distinct from old.moeda and exists (
    select 1 from public.contas c where c.user_id = old.user_id and c.corretora = old.nome
  ) then
    raise exception 'corretora_com_contas';
  end if;
  return new;
end;
$$;

create trigger trg_proteger_moeda_da_corretora
  before update of moeda on public.corretoras
  for each row execute function public.proteger_moeda_da_corretora();

-- plano.ativos é um array (não tem FK): renomear/remover o ativo acompanha aqui.
create or replace function public.sincronizar_plano_com_ativos()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    update public.plano
    set ativos = array_replace(ativos, old.codigo, new.codigo)
    where user_id = new.user_id and old.codigo = any(ativos);
  else
    update public.plano
    set ativos = array_remove(ativos, old.codigo)
    where user_id = old.user_id and old.codigo = any(ativos);
  end if;
  return null;
end;
$$;

create trigger trg_plano_ativos_renomeado
  after update of codigo on public.ativos
  for each row when (old.codigo is distinct from new.codigo)
  execute function public.sincronizar_plano_com_ativos();

create trigger trg_plano_ativos_removido
  after delete on public.ativos
  for each row execute function public.sincronizar_plano_com_ativos();

-- valor_ponto do trade continua CONGELADO no cadastro. Renomear o código de um
-- ativo (on update cascade) não pode refazer o snapshot: o código antigo já não
-- existe no cadastro quando o cascade chega em `trades`.
create or replace function public.definir_valor_ponto_trade()
returns trigger
language plpgsql
as $$
declare
  corretora_da_conta text;
  vp numeric;
begin
  if tg_op = 'UPDATE' and new.conta_id is not distinct from old.conta_id then
    if new.ativo is not distinct from old.ativo then
      new.valor_ponto := old.valor_ponto;
      return new;
    end if;
    -- código renomeado em cascata: o antigo já não existe no cadastro
    if not exists (
      select 1 from public.ativos a where a.user_id = new.user_id and a.codigo = old.ativo
    ) then
      new.valor_ponto := old.valor_ponto;
      return new;
    end if;
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

-- -----------------------------------------------------------------------------
-- 9. RPCs da tela Corretoras (security invoker: a RLS vale)
-- -----------------------------------------------------------------------------

create or replace function public.criar_corretora(p_nome text, p_moeda moeda_conta, p_ativos text[])
returns void
language plpgsql
as $$
begin
  insert into public.corretoras (nome, moeda) values (p_nome, p_moeda);

  insert into public.valores_ponto_corretora (corretora, ativo, tamanho_tick, valor_tick, unidade)
  select p_nome, a.codigo, a.tamanho_tick, a.valor_tick, a.unidade
  from public.ativos a
  where a.user_id = auth.uid() and a.codigo = any(p_ativos);
end;
$$;

create or replace function public.vincular_ativo(p_corretora text, p_ativo text)
returns void
language plpgsql
as $$
begin
  insert into public.valores_ponto_corretora (corretora, ativo, tamanho_tick, valor_tick, unidade)
  select p_corretora, a.codigo, a.tamanho_tick, a.valor_tick, a.unidade
  from public.ativos a
  where a.user_id = auth.uid() and a.codigo = p_ativo;

  if not found then
    raise exception 'ativo_inexistente';
  end if;
end;
$$;

create or replace function public.voltar_ao_padrao(p_corretora text, p_ativo text)
returns void
language plpgsql
as $$
begin
  update public.valores_ponto_corretora v
  set tamanho_tick = a.tamanho_tick,
      valor_tick = a.valor_tick,
      unidade = a.unidade
  from public.ativos a
  where v.user_id = auth.uid()
    and v.corretora = p_corretora
    and v.ativo = p_ativo
    and a.user_id = v.user_id
    and a.codigo = v.ativo;
end;
$$;

revoke all on function public.criar_corretora(text, moeda_conta, text[]) from public, anon;
revoke all on function public.vincular_ativo(text, text) from public, anon;
revoke all on function public.voltar_ao_padrao(text, text) from public, anon;
grant execute on function public.criar_corretora(text, moeda_conta, text[]) to authenticated;
grant execute on function public.vincular_ativo(text, text) to authenticated;
grant execute on function public.voltar_ao_padrao(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 10. Os enums não são mais usados
-- -----------------------------------------------------------------------------

drop type public.ativo;
drop type public.corretora;

-- -----------------------------------------------------------------------------
-- 11. Asserções: se QUALQUER uma falhar, a transação inteira é desfeita
-- -----------------------------------------------------------------------------

do $$
declare
  n bigint;
begin
  select count(*) into n
  from _vpc_antes a
  join public.valores_ponto_corretora v
    on v.user_id = a.user_id and v.corretora = a.corretora and v.ativo = a.ativo
  where v.valor_ponto is distinct from a.valor_ponto;
  if n > 0 then
    raise exception 'ASSERÇÃO: % valor(es) por ponto de corretora mudaram', n;
  end if;

  if (select count(*) from _vpc_antes) <> (select count(*) from public.valores_ponto_corretora) then
    raise exception 'ASSERÇÃO: o número de vínculos corretora × ativo mudou';
  end if;

  select count(*) into n
  from _trades_antes a
  join public.trades t on t.id = a.id
  where t.valor_ponto is distinct from a.valor_ponto;
  if n > 0 then
    raise exception 'ASSERÇÃO: % trade(s) tiveram o valor por ponto alterado', n;
  end if;

  select count(*) into n
  from _contas_antes a
  join public.contas c on c.id = a.id
  where c.moeda is distinct from a.moeda;
  if n > 0 then
    raise exception 'ASSERÇÃO: % conta(s) mudaram de moeda', n;
  end if;

  select count(*) into n
  from _contagens_antes a
  where a.trades <> (select count(*) from public.trades t where t.user_id = a.user_id)
     or a.backtestes <> (select count(*) from public.backtestes b where b.user_id = a.user_id)
     or a.estudos <> (select count(*) from public.estudos e where e.user_id = a.user_id);
  if n > 0 then
    raise exception 'ASSERÇÃO: a contagem de trades/backtestes/estudos mudou para % usuário(s)', n;
  end if;

  select count(*) into n
  from auth.users u
  where (select count(*) from public.ativos a where a.user_id = u.id) < 7;
  if n > 0 then
    raise exception 'ASSERÇÃO: % usuário(s) ficaram sem os 7 ativos padrão', n;
  end if;
end $$;

commit;
