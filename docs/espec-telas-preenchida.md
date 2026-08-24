# GuspaGain v2 — Especificação das Telas

> Preencha este arquivo com sua palavra. Não se preocupe com termo técnico ou com o que existe hoje no Bubble — **Quero um app para estudo de day trade, para eu conseguir estudar os setups e saber as estatisticas, para eu saber como estou indo em cada trade (perfomance) e também para analisar os dados de estudo (backteste) com o que estou fazendo na real (perfomance)**, não o que você tem. Onde não souber ou não tiver decidido, escreva `??` e siga em frente.
>
> Quando terminar (ou mesmo parcialmente), me chame que eu confiro, aponto os furos e a gente decide o próximo passo.

---

## Como preencher um campo

O formato abaixo é sugestão. **Texto solto também serve** — o que importa é a informação estar lá.

```
- Estado do preço
  tipo: lista
  opções: Super comprador, Comprador, Entre as médias, Vendedor, Super vendedor
  obrigatório: sim
  aparece na tabela: sim
  serve de filtro: sim
  responde: "em qual estado do preço eu acerto mais?"
```

**Tipos disponíveis:** `texto livre` · `número` · `data` · `hora` · `sim/não` · `lista` · `imagem` · `link para outro cadastro`

**O campo `responde` é o mais importante.** Ele decide se o campo vira lista fechada (analisável — entra nos gráficos e no ranking de edge) ou texto livre (só leitura, nunca vira estatística). É o erro mais caro de corrigir depois. Se um campo é só anotação sua e você nunca vai querer cruzar com nada, escreva `responde: nada, é só registro`.

---

# 1. SETUPS

**Objetivo:**
Cadastrar os setups que irei estudar para saber as estatisticas

**Campos do cadastro:** (na ordem em que você quer preencher)
Nome: CEB (Clearing Elephant Bull)
Descrição: Setup para quando tem uma congestão e tem uma barra que limpa os ultimos 5 preços e é pelo menos 2x maior que as anteriores
Imagem: 
**Colunas da listagem:** (nem todo campo precisa aparecer)
Foto do setup
Nome
Assertividade
Risco retorno
Quantidade de backteste
Quantidade de trades reais

**Ordenação padrão:**
Gostaria de poder ordenar como eu quiser, se tiver como ter um drag and drop ou nas açoes ter uma opcao de escolher em que sequencia quero colocar esse setup

**Filtros:**
Na tela de setups por enquanto nao pensei em nenhum filtro

**Cards / gráficos no topo:** (e a conta de cada um)
Nessa tela acho que gostaria de cada setup dentro de um card e nele puxar qual a assertividade e risco retorno médio desse setup.

**Ações disponíveis:** (editar, excluir, duplicar, arquivar...)
Editar, apagar e Ordenaçao (Gostaria de ter um drag and drop com a posicao que quero deixar, ou um )

**Navegação:** (clicar em quê abre o quê)
Não vai ter clique, apenas nas acoes que vai ter o clique

---

# 2. BACKTESTE

> Aqui existem dois níveis: o **Bloco** (o container nomeado, ex.: "Backteste 2m Ouro VBS") e a **Linha** (cada estudo individual dentro dele). Preencha os dois. Se você quiser mudar essa estrutura de dois níveis, fale — nada está fixo.

## 2.1 Tela de Blocos (lista)

**Objetivo:**
Realizar estudo para cada tempo gráfico, gostaria de saber dentro do 1m qual a assertividade, qual risco retorno e etc...

**Campos do cadastro do bloco:**
Tempo gráfico: (1m, 2m, 3m, 5m, 10m ou 15m)

**O que aparece em cada bloco na lista:** (nome, e quais números de resumo?)
Tempo gráfico escolhido (2m)
Quantidade de backteste
Risco retorno médio
Asseritividade média

**Ordenação padrão:**
Ordenar do menor tempo gráfico ao maior

**Filtros:**
Nessa tela não pensei em filtros ainda

**Cards / gráficos no topo da tela:** (e a conta de cada um)
Total de backteste
Assertividade geral
Risco retorno geral


**Ações:**
Editar, remover

## 2.2 Tela de dentro do Bloco (linhas de estudo)

**Objetivo:**
Aqui o objetivo é preencher o backteste do tempo gráfico selecionado

**Campos do cadastro da linha:**
Ativo - (dropdown com os ativos pré cadastrados) valores (MES, MYM, MNQ, MGC, MCL, BTC)
Data - seletor de data
Período - dropdown com as opcoes (Manhã, tarde ou noite)
Tempo gráfico - Esse campo ele vai vir ja preenchido pois voce já vai ter escolhido em qual tempo grafico quer fazer o backteste
Operação - dropdown com (Compra ou venda)
Setup - Dropdown com a lista dos setups cadastrados de cada usuário
Evento - Dropdown com as opcoes (Barra elefante, Tail, 180, Troca de cor)
Tamanho do stop - Input Numerico (10) - Aqui vai ser sempre um numero decimal
Entrada - Dropdown com a opcao (Confirmada, Antecipada)
M200 - Dropdown com as opcao (Plana, Inclinada para cima ou Inclinada para baixo)
M20 - Dropdown com as opcao (Plana, Inclinada para cima ou Inclinada para baixo)
Alinhamento do mercado - Dropdown com as opçoes (Lateral, contra a tendencia ou a favor da tendencia)
Localização - Dropdown com as opcoes (Enconstado na m20, Proximo a m20, Longe da m20 e Encostado na 20 e 200)
Resultado - Dropdown com as opcoes (Gain ou Loss)
Risco retorno - Dropdown com as opcoes (LOSS, O.5:1, 0.66:1, 1:1, 1.5:1, 2:1, 3:1, 4:1 ou mais)
Notas - Input para escrever observação

**Colunas da listagem:**
Todas colunas do campo de cadastro

**Ordenação padrão:**
Registro mais novos aparecem primeiro

**Filtros:**
Filtrar por setup 

**Cards / gráficos no topo:** (e a conta de cada um)
<!-- -->

**Ações:**
<!-- -->

---

# 3. PERFOMANCE

**Objetivo:**
Registrar cada operação individual para analisar 

**Campos do cadastro:**
Conta - Selecionar conta cadastrada
Data - seletor de data
Horário inicial - Horário de inicio da operação
Horario Final - Horario final da operação
Ativo - (MES, MYM, MNQ, MGC, MCL OU BTC)
Tempo gráfico - (1m, 2m, 3m, 5m ou 15m)
Setup - Lista dos setups cadastrados
Pontos - Numerico vai ser o tamanho do meu stop em pontos
Contratos - Numero aqui vai ser a quantidade de contratos que foi essa operação
Stop inicial - Aqui vai ser o valor em dolár do stop inicial
Resultado - Aqui vai ser o valor em dolar da operação
Risco retorno - (LOSS, O.5:1, 0.66:1, 1:1, 1.5:1, 2:1, 3:1, 4:1 ou mais)
Respeitou o plano - (Sim ou Nao)
Imagem - Imagem enviada do trade realizado
Observaçao - Input para escrever as observacoes
**Colunas da listagem:**
Todas colunas de cadastro

**Ordenação padrão:**
Cadastros mais recentes primeiros

**Filtros:**
Filtro por setup, filtro por tempo grafico

**Cards / gráficos no topo:** (e a conta de cada um)
Saldo atual - Saldo da conta 
Quantidade de trades - Numero total de perfomance
Assertividade - Assertividade da perfomance
Fator lucro - Média do risco retorno
Média resultado ganho - Média das operacoes vencedoras
Media resultados perdidos - Media das operacoes perdedoras
MLPT - Valor que aceita perder por trade (Esse dado ja vai estar cadastrado na conta)

Gráfico de evolução acumulada da conta (Gráfico de linha para ver a evolução)
Gráfico de resultado individual por operação - Grafico de barras e gostaria de uma linha mostrando o valor do MLPT para saber se cada trade que estou fazendo está proximo do que eu aceito perder/ganhar


**Ações:**
Editar, Remover

---

# 4. CONTA

**Objetivo:**
Cadastrar cada conta de trading informando o tamanho da conta, o risco que aceita perder em cada trade, separar conta real de simulador e etc...

**Campos do cadastro:**
Numero da conta - ID da conta 
Tipo de conta - Remunerada ou Simulador
Valor da conta - Valor da conta atual
Risco por trade (MLPT) - Valor em dolar do risco de cada trade


**Filtros:**
Não pensei em filtros para esas tela

**Ações:**
Editar ou remevor

---

# 5. DASHBOARD

> Deixado por último de propósito: o dashboard só consegue mostrar o que os cadastros acima gravaram.

Vamos pensar nisso, pois a perfomance ja vai ter uma dashboard com os dados e um botao para cadastrar um novo trade, já o backteste tem alguns dados de risco retorno, assertividade, entao nao sei se vai precisar ter uma tela so para dashboard, acho melhor ter individualmente o backteste e a perfomance uma dashboard ao acessar

---

# 6. LABORATÓRIO DE EDGE

Não quero essa tela no momento
---

# 7. NAVEGAÇÃO E LAYOUT GERAL

**Ordem das seções no menu lateral:**
Conta
Setup
Backteste
Perfomance

**Qual tela abre ao entrar no app:**
Conta - abre a tela para cadastar ou editar uma conta
Setup - Abre a tela para fazer o crud dos setups
Backteste - Abre a dashboard do backteste podendo continuar um backteste de um tempo grafico ou criar um novo
Perfomance - Abre a dashboard dos trades reais

**Alguma coisa da identidade visual que você quer mudar?**
<!-- hoje: fundo quase preto rgb(4,9,17), azul/ciano #00CFFF, fontes Inter + Space Grotesk -->
Gostaria de manter mais quero alterar a fonte, usar a inter com mais alguma outra. Também aceito sugestão de tela para aplicativo de day trade

---

# 8. PENDÊNCIAS — responda quando puder

**8.1 `localizacao` (loc1..loc5)** — você disse que quer repensar. Me diz com suas palavras o que você olha quando pensa *"onde esse trade aconteceu"*. Ela precisa medir algo que `estado_do_preco` (posição vs. médias), `correcao` (Fibonacci) e `pernada` (estágio do movimento) já não medem.

Candidatos: estrutura do dia (topo/fundo anterior, máxima/mínima, abertura, gap) · nível psicológico (número redondo, VWAP) · zona de congestão (dentro / borda / rompendo) · outro.

Resposta:
<!-- -->

**8.2 TT, BT e NRB** — aparecem na lista de `adicao` ("Sim na TT", "Sim na BT", "Sim na NRB") mas **não existem** na lista de eventos. São eventos que faltam cadastrar, ou outra coisa?

Resposta:
<!-- -->

**8.3 Assertividade por estado do preço** — o documento diz que esse gráfico roda sobre Perfomance, mas Perfomance não tem o campo `estado_do_preco`. Esse gráfico é sobre backteste, ou você quer passar a gravar estado do preço nos trades reais também?

Resposta:
<!-- -->

**8.4 Nome do setup** — hoje o setup só tem `descricao` (texto longo). Quer um nome curto separado, pra usar em dropdown e legenda de gráfico?

Resposta:
<!-- -->

**8.5 Lista de eventos** — a lista atual é: Bull, Bear, Bull 180, Bear 180, VBS, VSS, BOP, BDP, CDB, CAS, Clearing Bull, Clearing Bear, RBI, GBI, RBTO, GBTO, GIFT. Está completa e correta? Falta ou sobra algum?

Resposta:
Barra elefante, Tail, 180, Mudança de cor

**8.6 Ativos** — hoje: S&P, DOW JONES, OIL, BITCOIN, GOLD, NASDAQ (BITCOIN está duplicado, vou limpar). Quer adicionar ou tirar algum?

Resposta:
Pode manter os ativos e as siglas
