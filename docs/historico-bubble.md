# GuspaGain — contexto para reconstrução (Bubble → Next.js/Vercel/Supabase)

> Este documento descreve o app **GuspaGain** como ele existe hoje no Bubble, para servir de especificação funcional na reconstrução em código. Não é um export automático — o Bubble não gera código a partir do app visual — é uma leitura da estrutura de dados, regras de negócio e telas, feita por um arquiteto que acompanhou o projeto. Recomenda-se salvar este arquivo como `CLAUDE.md` na raiz do novo repositório para que o Claude Code carregue o contexto automaticamente.

## 1. O que é o GuspaGain

App de estudo para day traders, uso pessoal (não é um produto comercial hoje). Tem quatro áreas funcionais:

- **Setups**: cadastro das estratégias/critérios de entrada que o trader usa.
- **Backteste**: registro de estudos históricos testando um setup contra um ativo, sem dinheiro real — é onde o trader valida se uma estratégia funciona antes de operar de verdade.
- **Perfomance**: registro dos trades reais executados (dinheiro em jogo).
- **Diário**: diário de trading (anotações/imagens por data e ativo).

Cada uma dessas áreas tem uma tela própria dentro do app.

## 2. Stack alvo e decisões já tomadas

- Front-end + hosting: Vercel, plano **Hobby (gratuito)**. Atenção: o plano Hobby é restrito por política da Vercel a uso **pessoal e não-comercial** — se o GuspaGain um dia virar algo pago/multiusuário fora do círculo pessoal, precisa migrar pro plano Pro (~US$20/mês).
- Banco de dados: Supabase Postgres, plano **Free**. Limites relevantes: 500 MB de banco, 2 projetos, projeto pausa automaticamente após 1 semana sem uso (precisa reativar manualmente no painel se ficar muito tempo sem abrir o app).
- **Autenticação e controle de acesso por usuário**: no Bubble, foi decidido **não configurar Privacy Rules por enquanto** — ou seja, hoje qualquer busca no app Bubble depende de filtro manual por `Created By = Current User`, não de uma regra automática do banco. Essa mesma decisão reaparece no Supabase na forma de **Row Level Security (RLS)**. Importante: por padrão, uma tabela no Supabase fica exposta pela API a menos que RLS seja habilitado e configurado — é um comportamento diferente do Bubble (que barra a Data API por padrão). **Claude Code deve perguntar explicitamente qual dos dois caminhos seguir (RLS configurado, ou app de uso restrito/confiável sem RLS por enquanto) antes de escolher um dos dois extremos sozinho.**

## 3. Modelo de dados atual (Bubble) e proposta de schema relacional

Nomes de campo abaixo já estão "traduzidos" do formato interno do Bubble (ex.: `ativo_id_option_ativos` → `ativo`) para ficar mais legível.

### 3.1 Enums (Option Sets no Bubble)

| Enum | Valores |
|---|---|
| `ativo` | S&P, DOWJONES, OIL, BITCOIN, GOLD, NASDAQ *(há uma entrada duplicada de BITCOIN no Bubble — provável resíduo de cadastro; vale limpar na reconstrução, não replicar a duplicata)* |
| `tempo_grafico` | 1m, 2m, 3m, 5m |
| `resultado` | Gain, Loss |
| `congestao` | Micro, Macro |
| `pernada` | 1 pernada, 2 pernadas, 3 pernadas, 4 pernadas ou mais |
| `correcao` | 33%, 50%, 61.8%, 76.4% |
| `localizacao` | loc1, loc2, loc3, loc4, loc5 *(nomes genéricos hoje — perguntar ao usuário se têm significado real a ser renomeado)* |
| `movimentacao` | A favor, Contra tendência, Lateral |
| `estado_do_preco` | Super comprador, Comprador, Entre as médias, Vendedor, Super vendedor |
| `inclinacao_media` | Inclinada ▲ acima do preço, Inclinada ▲ abaixo do preço, Plana no meio do preço, Inclinada ▼ acima do preço, Inclinada ▼ abaixo do preço, Plana acima do preço, Plana abaixo do preço |
| `evento` | Bull, Bear, Bull 180, Bear 180, VBS*, VSS*, BOP*, BDP*, CDB, CAS, Clearing Bull, Clearing Bear, RBI, GBI, RBTO, GBTO, GIFT — *(os marcados com * têm o atributo `tendencia = true` no Bubble)* |
| `adicao` | Não teve adição, Sim na GBI, Sim na RBI, Sim na TT, Sim na BT, Sim na NRB, Sim no GIFT, Sim na GBTO, Sim na RBTO, Sim no VBS, Sim no VSS |
| `status_trade` | Estratégia Correta, Erro de Operação, Não Sei (Emocional) |

**`risco_retorno`**: no Bubble é um option set de texto (`"2:1"`, `"1.5:1"` etc.), o que impede tirar média nativamente — precisou de um atributo numérico auxiliar. **Na reconstrução, não replicar esse padrão**: armazenar `risco_retorno` como `numeric` direto (ex.: `2.0`, `1.5`), é mais simples e correto desde o início.

### 3.2 Tabelas

**`setups`** — cadastro de estratégias
- `descricao` (text)
- `imagem_setup_url` (text/url)
- `evento` (enum `evento`)
- `user_id`, `created_at`

**`blocos_backteste`** — *(conceito novo, ainda não existe no Bubble — ver seção 4)*
- `nome` (text, livre)
- `ativo` (enum `ativo`)
- `setup_id` (FK → setups)
- `tempo_grafico` (enum `tempo_grafico`)
- `user_id`, `created_at`

**`backtestes`** — linha individual de estudo
- `bloco_id` (FK → blocos_backteste, **nullable** — ver seção 4)
- `ativo` (enum `ativo`)
- `setup_id` (FK → setups)
- `tempo_grafico` (enum `tempo_grafico`)
- `data_backteste` (date)
- `imagem_url` (text)
- `stop_pivo`, `stop_evento` (numeric)
- `double_deep` (boolean)
- `congestao` (enum)
- `pernada` (enum)
- `correcao` (enum)
- `resultado_pivo`, `resultado_evento` (enum `resultado`) — **são dois resultados independentes por linha**: um para o "evento" (o movimento como um todo) e outro para o "pivô" (um ponto de entrada mais refinado dentro do mesmo evento). Isso não é redundância — são duas análises diferentes do mesmo registro.
- `movimentacao` (enum)
- `estado_do_preco` (enum)
- `localizacao` (enum)
- `inclinacao_m20`, `inclinacao_m200` (enum `inclinacao_media`) — inclinação da média móvel de 20 e de 200 períodos
- `risco_retorno_evento`, `risco_retorno_pivo` (numeric)
- `user_id`, `created_at`

**`perfomances`** — trades reais executados
- `data` (date)
- `ativo` (enum)
- `setup_id` (FK → setups)
- `tempo_grafico` (enum)
- `imagem_url` (text)
- `duracao` (text — hoje é texto livre no Bubble, ex.: "15min"; avaliar se vale virar `interval`/número de minutos na reconstrução)
- `pontos` (numeric) — resultado em pontos do ativo
- `observacao` (text)
- `contratos` (numeric) — quantidade operada
- `resultado` (numeric) — resultado financeiro
- `conducao_m8`, `conducao_pivo`, `conducao_barra_barra` (numeric) — pontos de gestão de posição em diferentes referências
- `stop_inicial` (numeric)
- `adicao` (enum) — se houve entrada adicional na posição, e em qual evento
- `status` (enum `status_trade`) — avaliação pós-trade (acertou a estratégia, errou a execução, ou decisão emocional)
- `risco_retorno` (numeric)
- `user_id`, `created_at`

**`diarios`** — diário de trading
- `data` (date)
- `ativo` (enum)
- `imagem_url` (text)
- `user_id`, `created_at`

## 4. Novo conceito: Blocos de Backteste (decisão já tomada, ainda não implementada no Bubble)

Hoje, no Bubble, `backtestes` são linhas soltas, agrupadas apenas por filtro (ativo + setup + intervalo de data) na tela. Isso quebra se o usuário quiser refazer um estudo sobre a mesma combinação ativo+setup+tempo gráfico depois de ajustar a estratégia — os registros novos e antigos se misturariam.

Decisão: criar a entidade `blocos_backteste` como container nomeado (ex.: "Backteste 2m Ouro VBS"), e cada linha de `backtestes` passa a se vincular a um bloco via `bloco_id`.

Decisões específicas já confirmadas com o usuário:
- **Nome do bloco é texto livre**, digitado pelo usuário — não gerado automaticamente. Não usar o nome como chave de lógica/filtro, só como rótulo de exibição.
- **Sem migração de dados antigos**: registros de `backtestes` já existentes ficam sem `bloco_id` (campo nullable) — não precisam ser agrupados retroativamente.
- **Estatísticas por bloco são calculadas ao vivo** (queries agregadas), não cacheadas em colunas — evita lógica de recálculo e risco de dado desatualizado. Só reconsiderar se o volume de dados crescer muito.
- Os campos `ativo`/`setup_id`/`tempo_grafico` continuam existindo tanto no bloco quanto em cada linha de `backtestes` (dado duplicado proposital, herdado do Bubble) — na reconstrução em código isso pode ser resolvido de forma mais limpa: a linha pode herdar esses valores do bloco via join, sem precisar duplicar a coluna. Fica a critério de quem implementar.

### Dashboard inicial da tela de blocos (cards de resumo)

Métrica base escolhida pelo usuário: **Pivô** (`resultado_pivo` e `risco_retorno_pivo`), não Evento.

1. **Total de backtestes**: `count(*) from backtestes where user_id = current_user`
2. **Quantidade de blocos**: `count(*) from blocos_backteste where user_id = current_user`
3. **Assertividade geral (Pivô)**: `count(resultado_pivo = 'gain') / count(resultado_pivo is not null) * 100`, considerando só linhas com `resultado_pivo` preenchido
4. **Risco/retorno médio geral (Pivô)**: `avg(risco_retorno_pivo)` onde não nulo

Tratar divisão por zero / lista vazia (mostrar "—" quando não há dados ainda).

## 5. Regras de negócio existentes a replicar

### 5.1 Assertividade por estado do preço (tela Perfomance → dashboard)

Para cada valor de `estado_do_preco` (super comprador, comprador, entre as médias, vendedor, super vendedor), calcula-se, sobre os registros de `perfomances` do usuário:
- Total de trades nesse estado
- Total de trades com `resultado_evento = gain` nesse estado (obs.: aqui o Bubble usa o campo de resultado do tipo `resultado`, ligado à mesma constraint de estado — no contexto de Perfomance é o resultado do trade)
- Assertividade = gain / total × 100

Isso alimenta um gráfico de barras (hoje feito com Chart.js embutido via HTML customizado no Bubble) com uma cor de destaque quando a assertividade daquele estado é ≥ 60%.

### 5.2 Filtros padrão nas listagens

As listagens de `backtestes` e `perfomances` são filtradas por: ativo, setup, período de data (data inicial/final) e localização — todos como filtros combináveis, ignorando os que estiverem vazios (equivalente a um `WHERE` dinâmico que só aplica as condições preenchidas).

## 6. Telas e navegação

O app Bubble funciona como uma SPA de fato: uma única página principal com um menu lateral fixo e uma área de conteúdo que troca de seção via um estado (`view`), sem recarregar página — isso mapeia bem para rotas client-side em Next.js (ex.: `/dashboard`, `/perfomance`, `/diario`, `/setups`, `/backtestes`) ou para um layout com tabs.

Seções:
- **Dashboard**: visão geral com o gráfico de assertividade por estado do preço (seção 5.1).
- **Perfomance**: CRUD dos trades reais, listagem em tabela paginada com os filtros da seção 5.2, popups de cadastro/edição/exclusão (exclusão sempre com confirmação — "essa ação não poderá ser desfeita").
- **Diário**: CRUD de entradas do diário (data, ativo, imagem).
- **Setups**: CRUD de setups (descrição, imagem, evento vinculado).
- **Backtestes**: CRUD das linhas de estudo — **é aqui que entra a reestruturação em Blocos** (seção 4): tela de lista de blocos com os 4 cards de resumo → clique no bloco abre a listagem de linhas daquele bloco → cadastro de nova linha dentro do bloco herda ativo/setup/tempo gráfico automaticamente.
- **Login/logout**: autenticação nativa (hoje só armazena `nome` no perfil do usuário); logout redireciona para a tela de login.

Identidade visual: tema escuro (fundo quase preto, ex. `rgb(4,9,17)`), fontes Inter e Space Grotesk, cantos arredondados, paleta de destaque em azul/ciano (`#00CFFF`). Vale manter essa identidade na reconstrução.

## 7. Avisos importantes para quem for implementar (débito técnico consciente)

- **RLS no Supabase precisa de decisão explícita** (seção 2) — não herdar silenciosamente nem o "tudo aberto" nem o "tudo trancado" sem perguntar ao usuário.
- **Nome do bloco de backteste é livre** — não impor geração automática nem normalização não pedida.
- **Não migrar dados legados de backteste** para dentro de blocos — foi decisão explícita do usuário.
- **Base de cálculo do dashboard de blocos é Pivô, não Evento** — os dois existem no modelo e representam análises diferentes do mesmo registro; não assumir que um substitui o outro.
- **Duplicata em `ativo` (BITCOIN aparece duas vezes no option set original)** — provável erro de cadastro no Bubble; sinalizar ao usuário antes de decidir se replica ou limpa.
