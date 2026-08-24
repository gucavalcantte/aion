-- =============================================================================
-- AION — schema inicial
-- Cole inteiro no SQL Editor do Supabase e rode de uma vez.
--
-- Duas coisas que este arquivo faz além de criar tabelas:
--
-- 1. RLS ligado em tudo. A separação entre os dois usuários passa a ser
--    garantida pelo banco, não pela memória de quem escreve a query.
-- 2. Campos deriváveis são GENERATED. Stop em dólar, resultado em pontos e o
--    status Gain/Loss/Zerado não podem ser digitados nem ficar inconsistentes,
--    porque o Postgres os calcula.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type ativo            as enum ('MES', 'MYM', 'MNQ', 'MGC', 'MCL', 'MBT');
create type tempo_grafico    as enum ('1m', '2m', '3m', '5m', '15m', '60m', '1D');
create type periodo          as enum ('Manhã', 'Tarde', 'Noite');
create type operacao         as enum ('Compra', 'Venda');
create type evento           as enum ('Barra elefante', 'Tail', '180', 'Troca de cor');
create type entrada          as enum ('Confirmada', 'Antecipada');
create type inclinacao       as enum ('Plana', 'Inclinada para cima', 'Inclinada para baixo');
create type alinhamento      as enum ('Lateral', 'Contra a tendência', 'A favor da tendência');
create type localizacao      as enum ('Encostado na M20', 'Próximo à M20', 'Longe da M20', 'Encostado na M20 e M200');
create type resultado        as enum ('Gain', 'Loss');
create type tipo_conta       as enum ('Remunerada', 'Simulador');
create type tipo_lancamento  as enum ('Saque', 'Aporte');

-- -----------------------------------------------------------------------------
-- Valor do ponto por ativo
-- Constante da aplicação. Existe aqui para as colunas geradas poderem usá-la.
-- MCL é pensado em %: 1% = 1,00 de movimento = $100 por contrato.
-- -----------------------------------------------------------------------------

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
  end
$$;

-- -----------------------------------------------------------------------------
-- contas
-- -----------------------------------------------------------------------------

create table public.contas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),

  numero        text not null,
  tipo_conta    tipo_conta not null,
  saldo_inicial numeric(14, 2) not null,
  -- nulo = conta sem meta (simulador, por exemplo)
  meta          numeric(14, 2),
  mlpt          numeric(12, 2) not null,
  mlpd          numeric(12, 2) not null,
  is_padrao     boolean not null default false,

  constraint contas_meta_positiva check (meta is null or meta > 0),
  constraint contas_mlpt_positivo check (mlpt > 0),
  constraint contas_mlpd_positivo check (mlpd > 0)
);

-- só uma conta padrão por usuário, garantido pelo banco
create unique index contas_padrao_unica
  on public.contas (user_id)
  where is_padrao;

-- -----------------------------------------------------------------------------
-- setups
-- Os seis campos plano_* formam a linha do setup no Plano e na folha impressa.
-- -----------------------------------------------------------------------------

create table public.setups (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  nome       text not null,
  descricao  text,
  imagem_url text,
  ordem      integer not null default 0,

  plano_evento      text,
  plano_adicao      text,
  plano_localizacao text,
  plano_stop        text,
  plano_realizacao  text,
  plano_gestao_stop text
);

create index setups_ordem on public.setups (user_id, ordem);

-- -----------------------------------------------------------------------------
-- plano — um registro por usuário (o "pré-mercado")
-- MLPT e MLPD não ficam aqui: o Plano os lê da conta selecionada.
-- -----------------------------------------------------------------------------

create table public.plano (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  janela_inicio        time,
  janela_fim           time,
  min_trades           integer,
  max_trades           integer,
  max_loss_seguidos    integer,
  ativos               ativo[] not null default '{}',
  regras               text[]  not null default '{}',
  checklist_abertura   text[]  not null default '{}',
  checklist_fechamento text[]  not null default '{}',
  nota_rodape          text,
  revisado_em          date
);

-- -----------------------------------------------------------------------------
-- backtestes
-- Sem imagem. O "bloco" é apenas o tempo_grafico.
-- -----------------------------------------------------------------------------

create table public.backtestes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  ativo         ativo not null,
  data          date not null,
  periodo       periodo not null,
  tempo_grafico tempo_grafico not null,
  operacao      operacao not null,
  -- restrict: apagar um setup estudado apagaria o estudo junto
  setup_id      uuid not null references public.setups (id) on delete restrict,
  evento        evento not null,
  tamanho_stop  numeric(12, 4) not null,
  entrada       entrada not null,
  m20           inclinacao not null,
  m200          inclinacao not null,
  alinhamento   alinhamento not null,
  localizacao   localizacao not null,
  resultado     resultado not null,
  -- LOSS grava -1, e por isso a média deste campo é a expectativa em R
  risco_retorno numeric(6, 2) not null,
  notas         text
);

create index backtestes_bloco  on public.backtestes (user_id, tempo_grafico, data desc);
create index backtestes_setup  on public.backtestes (user_id, setup_id);

-- -----------------------------------------------------------------------------
-- trades — exibido como "Perfomance"
-- Não existe duração: o que interessa é o horário real de entrada e saída.
-- -----------------------------------------------------------------------------

create table public.trades (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  conta_id      uuid not null references public.contas (id) on delete restrict,
  data          date not null,
  hora_inicio   time not null,
  hora_fim      time not null,
  ativo         ativo not null,
  tempo_grafico tempo_grafico not null,
  setup_id      uuid not null references public.setups (id) on delete restrict,
  pontos_stop   numeric(12, 4) not null,
  contratos     integer not null,
  resultado     numeric(14, 2) not null,
  risco_retorno numeric(6, 2),
  respeitou_plano boolean not null,
  imagem_url    text,
  observacao    text,

  constraint trades_contratos_positivo check (contratos > 0),
  constraint trades_stop_positivo      check (pontos_stop > 0),

  -- Calculados pelo banco. Não podem ser digitados, logo não podem divergir.
  stop_dolar numeric(14, 2)
    generated always as (pontos_stop * valor_do_ponto(ativo) * contratos) stored,
  resultado_pontos numeric(14, 4)
    generated always as (resultado / nullif(valor_do_ponto(ativo) * contratos, 0)) stored,
  status text
    generated always as (
      case when resultado > 0 then 'Gain'
           when resultado < 0 then 'Loss'
           else 'Zerado' end
    ) stored
);

create index trades_conta on public.trades (user_id, conta_id, data desc, hora_inicio desc);
create index trades_setup on public.trades (user_id, setup_id);

-- -----------------------------------------------------------------------------
-- lancamentos — saque e aporte
-- Entram no saldo e saem de tudo o mais: drawdown, MLPD e estatística usam
-- apenas trades. Um saque de $5.000 não é uma perda de $5.000.
-- -----------------------------------------------------------------------------

create table public.lancamentos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  conta_id   uuid not null references public.contas (id) on delete cascade,
  data       date not null,
  tipo       tipo_lancamento not null,
  valor      numeric(14, 2) not null,
  observacao text,

  constraint lancamentos_valor_positivo check (valor > 0)
);

create index lancamentos_conta on public.lancamentos (user_id, conta_id, data desc);

-- -----------------------------------------------------------------------------
-- estudos — prints do dia
-- Estudo não é trade: não entra em nenhuma estatística.
-- -----------------------------------------------------------------------------

create table public.estudos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  data          date not null,
  imagem_url    text,
  ativo         ativo not null,
  tempo_grafico tempo_grafico not null,
  observacao    text
);

create index estudos_data on public.estudos (user_id, data desc);

-- =============================================================================
-- RLS — uma policy por tabela, dona de tudo
--
-- Sem isto, a separação entre os dois usuários dependeria de o código lembrar
-- de filtrar por user_id em toda consulta. Um select esquecido e um vê os dados
-- do outro. Com isto, o banco recusa sozinho.
-- =============================================================================

alter table public.contas      enable row level security;
alter table public.setups      enable row level security;
alter table public.plano       enable row level security;
alter table public.backtestes  enable row level security;
alter table public.trades      enable row level security;
alter table public.lancamentos enable row level security;
alter table public.estudos     enable row level security;

create policy "dono" on public.contas      for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono" on public.setups      for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono" on public.plano       for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono" on public.backtestes  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono" on public.trades      for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono" on public.lancamentos for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono" on public.estudos     for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- Storage — um bucket privado, cada usuário na sua pasta
-- Caminho: imagens/<user_id>/<arquivo>
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('imagens', 'imagens', false)
on conflict (id) do nothing;

create policy "imagens do dono" on storage.objects for all to authenticated
using      (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);
