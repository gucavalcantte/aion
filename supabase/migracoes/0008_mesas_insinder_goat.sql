-- =============================================================================
-- AION — Mesas Insinder e Goat
--
-- Rodar em DUAS etapas, porque o Postgres não deixa usar um valor de enum
-- recém-criado na mesma transação que o `ALTER TYPE ... ADD VALUE`:
--
--   1. Selecione só o bloco "ETAPA 1" abaixo, cole no SQL Editor do Supabase
--      e rode.
--   2. Depois, selecione o bloco "ETAPA 2" e rode.
--
-- Rodar o arquivo inteiro de uma vez só falha com o erro
-- "unsafe use of new value of enum type".
--
-- Pré-requisito: crie o usuário da mesa no Supabase Auth ANTES de rodar a
-- ETAPA 2 — o seed abaixo faz cross join com auth.users, então só alcança
-- quem já existir naquele momento.
-- =============================================================================

-- ETAPA 1 -----------------------------------------------------------------
alter type corretora add value if not exists 'Insinder';
alter type corretora add value if not exists 'Goat';

-- ETAPA 2 -----------------------------------------------------------------
-- Insinder e Goat só cobrem lote micro de três ativos: Ouro (MGC), Nasdaq
-- (MNQ) e Dow Jones (MYM). Os valores por ponto vêm da tabela de contratos
-- micro informada pelo usuário.
insert into public.valores_ponto_corretora (user_id, corretora, ativo, valor_ponto, unidade)
select u.id, v.corretora, v.ativo, v.valor_ponto, v.unidade
from auth.users u
cross join (values
  ('Insinder'::corretora, 'MGC'::ativo, 1.00, 'pontos'),
  ('Insinder'::corretora, 'MNQ'::ativo, 2.00, 'pontos'),
  ('Insinder'::corretora, 'MYM'::ativo, 0.50, 'pontos'),
  ('Goat'::corretora,     'MGC'::ativo, 1.00, 'pontos'),
  ('Goat'::corretora,     'MNQ'::ativo, 2.00, 'pontos'),
  ('Goat'::corretora,     'MYM'::ativo, 0.50, 'pontos')
) as v(corretora, ativo, valor_ponto, unidade)
on conflict (user_id, corretora, ativo) do nothing;
