# AION — Especificação (v2)

App pessoal de estudo para day trade. Substitui o app antigo do Bubble
(chamado GuspaGain). **AION** = ciclos + tempo + consistência.
Fonte da verdade deste projeto. O `home/CLAUDE.md` antigo e o `home/ESPEC-TELAS.md`
estão **superados** — servem só como histórico da conversa.

## 1. Objetivo

Estudar setups de day trade e medir estatística, acompanhar a performance real
dos trades, e comparar o que foi estudado (backteste) com o que está sendo
executado de verdade (perfomance).

**Três usuários** (o dono, a esposa e um convidado em teste), uso pessoal, **desktop apenas**.

**Os dados são totalmente separados entre os três.** Setups, contas, backtestes e
trades pertencem a um `user_id` e nunca aparecem para os outros. Nada é
compartilhado — nem os setups. Toda consulta filtra por `user_id`.

## 2. Stack e decisões já tomadas

- **Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui**, hospedado na **Vercel Hobby**.
- **Supabase** (Postgres + Storage + Auth), plano Free.
- **RLS: decidir na Fase 1.** O schema já está pronto para os dois caminhos —
  `user_id` existe em todas as tabelas. Todo acesso a dados acontece no servidor
  (Server Components / Server Actions), com a chave do Supabase **server-only**
  (sem prefixo `NEXT_PUBLIC_`), então nada vaza pelo bundle.

  **O que mudou:** com três usuários no mesmo banco, a separação entre os dados
  deixou de depender só do servidor e passou a depender de o código lembrar de
  filtrar por `user_id` em **toda** consulta. Um `select` sem filtro e um usuário vê
  os dados de outro. Ligar RLS custa ~8 policies feitas uma vez e transfere essa
  garantia para o banco. **Perguntar ao usuário antes de começar a Fase 1.**
- **Banco começa zerado** — nenhuma migração do Bubble.
- Projeto Supabase Free pausa após 7 dias sem uso, então um **Vercel Cron semanal**
  bate num `SELECT 1` para manter ativo.

## 3. Convenções de dado

### 3.1 Enums

| Enum | Valores |
|---|---|
| `ativo` | MES, MYM, MNQ, MGC, MCL, MBT, WIN |
| `tempo_grafico` | 1m, 2m, 3m, 5m, 15m, 60m, 1D |
| `periodo` | Manhã, Tarde, Noite |
| `operacao` | Compra, Venda |
| `evento` | Barra elefante, Tail, 180, Troca de cor |
| `entrada` | Confirmada, Antecipada |
| `inclinacao` | Plana, Inclinada para cima, Inclinada para baixo |
| `alinhamento` | Lateral, Contra a tendência, A favor da tendência |
| `localizacao` | Encostado na M20, Próximo à M20, Longe da M20, Encostado na M20 e M200 |
| `resultado` | Gain, Loss |
| `tipo_conta` | Remunerada, Simulador |
| `tipo_lancamento` | Saque, Aporte |

### 3.2 Tabela de ativos (constante da aplicação, não editável pelo usuário)

| Código | Nome | Valor do ponto (na moeda do ativo) | Moeda | Rótulo da unidade |
|---|---|---|---|---|
| MES | S&P | 5,00 | USD | pontos |
| MYM | Dow | 0,50 | USD | pontos |
| MNQ | Nasdaq | 2,00 | USD | pontos |
| MGC | Gold | 10,00 | USD | dólares |
| MCL | Oil | 100,00 | USD | **%** |
| MBT | Bitcoin | 0,10 | USD | dólares |
| WIN | Mini Índice | 0,20 | BRL | pontos |

O rótulo da unidade muda o label do campo de stop conforme o ativo escolhido.
MCL é pensado em % pelo usuário: 1% = 1,00 de movimento = $100 por contrato.

**Moeda por ativo, sem conversão.** Os campos derivados de `valor_ponto`
(`stop_dolar` em `trades`, MLPT/MLPD na conta, etc.) herdam a moeda do próprio
ativo — WIN produz valores em R$, os demais em US$. O app não converte entre
moedas; o nome dos campos (`stop_dolar`, "em USD") é histórico de quando só
havia ativos em dólar e deve ser lido como "na moeda do ativo/conta", não
literalmente USD.

### 3.3 Risco/retorno

Armazenado **sempre como `numeric`**, nunca como texto. Na tela é um dropdown;
por trás grava número:

`LOSS → -1` · `0.5:1 → 0.5` · `0.66:1 → 0.66` · `1:1 → 1` · `1.5:1 → 1.5` · `2:1 → 2` · `3:1 → 3` · `4:1 ou mais → 4`

Consequência importante: **a média de `risco_retorno` — exibida como "Risco
retorno médio" — é a expectativa em R por operação.** Positiva = ganha dinheiro no
agregado; negativa = perde. É o número mais importante do app.

## 4. Schema

Todas as tabelas têm `id`, `user_id`, `created_at`.

### `contas`
- `numero` (text) — identificador da conta
- `tipo_conta` (enum)
- `moeda` (enum `USD` | `BRL`) — moeda de exibição da conta. Não converte:
  uma conta em BRL deveria operar só ativos nativos em BRL (hoje, só WIN).
  Default `USD` para não quebrar contas já cadastradas. No formulário de trade
  (Perfomance), o seletor de ativo filtra pela moeda da conta escolhida — uma
  conta em USD nunca oferece WIN, e uma conta em BRL só oferece WIN.
- `saldo_inicial` (numeric) — **saldo atual é sempre calculado**, nunca digitado
- `meta` (numeric, **nullable**) — lucro acumulado necessário para liberar o saque.
  Nulo = conta sem meta (simulador, por exemplo)
- `mlpt` (numeric) — perda máxima aceita por trade, em USD
- `mlpd` (numeric) — perda máxima aceita no dia, em USD
- `is_padrao` (boolean) — a conta pré-selecionada na Perfomance; só uma por usuário

### `lancamentos`
Movimentações de dinheiro que **não são resultado de operação**.

`conta_id` (FK) · `data` · `tipo` (`tipo_lancamento`) · `valor` (numeric, sempre
positivo) · `observacao` (text)

### Saldo e meta

- `saldo_atual` = `saldo_inicial + soma(trades.resultado) − soma(saques) + soma(aportes)`
- **Progresso da meta** = `(saldo_atual − saldo_inicial) ÷ meta`

O saque derruba o saldo, e com isso o progresso da meta cai sozinho — que é o
comportamento certo: sacou, começa a juntar de novo. Não é preciso zerar nada à mão.

Quando o progresso for negativo, exibir "abaixo do saldo inicial" em vez de barra
vazia com percentual negativo.

**Saque não é perda.** Três lugares precisam ignorá-lo:

1. **Drawdown do pico** — calculado sobre a série *só de operações*
   (`saldo_inicial + trades`). Se o saque entrasse, sacar $5.000 apareceria como
   um drawdown de $5.000 e poderia "estourar" o limite da conta sem você ter
   perdido nada.
2. **MLPD** — a soma do dia conta só `trades.resultado`.
3. **Assertividade, risco retorno, médias** — lançamento não é trade, não entra em
   nenhuma estatística.

**Gráfico de evolução:** a linha mostra o saldo real, com o degrau para baixo, e o
saque marcado como um ponto com rótulo. Ver o degrau é útil; contá-lo como perda
não é.

### `setups`
- `nome` (text) — nome curto, ex.: "CEB"
- `descricao` (text) — descrição longa do critério
- `imagem_url` (text, Supabase Storage)
- `ordem` (int) — posição definida pelo usuário via drag-and-drop

**Plano de execução** — seis campos de texto que compõem a linha do setup no Plano
(ver 5.6). São editados aqui, no próprio setup:
`plano_evento` · `plano_adicao` · `plano_localizacao` · `plano_stop` ·
`plano_realizacao` · `plano_gestao_stop`

### `plano` — um registro por usuário
Parte do plano que não pertence a um setup específico (o "pré-mercado"):

- `janela_inicio`, `janela_fim` (time) — janela operacional
- `min_trades`, `max_trades` (int)
- `max_loss_seguidos` (int) — depois de quantos losses seguidos encerra o dia
- `ativos` (array de `ativo`) — quais ativos o plano autoriza
- `regras` (text[]) — uma linha por regra
- `checklist_abertura` (text[])
- `checklist_fechamento` (text[])
- `nota_rodape` (text)
- `revisado_em` (date)

**MLPT e MLPD não ficam aqui.** O Plano os exibe lendo da conta selecionada.
Guardá-los nos dois lugares é como um dos dois fica desatualizado.

### `backtestes`
Sem imagem. Sem vínculo a bloco — o "bloco" é apenas o `tempo_grafico` (ver 5.2).

`ativo` · `data` · `periodo` · `tempo_grafico` · `operacao` · `setup_id` (FK) ·
`evento` · `tamanho_stop` (numeric, decimal) · `entrada` · `m20` (inclinacao) ·
`m200` (inclinacao) · `alinhamento` · `localizacao` · `resultado` ·
`risco_retorno` (numeric) · `notas` (text)

### `trades` — exibido como "Perfomance"

`conta_id` (FK) · `data` · `hora_inicio` · `hora_fim` · `ativo` · `tempo_grafico` ·
`setup_id` (FK) · `pontos_stop` (numeric) · `contratos` (int) · `resultado` (numeric USD) ·
`risco_retorno` (numeric) · `respeitou_plano` (boolean) · `imagem_url` · `observacao` (text)

**Campos calculados, nunca digitados** (evitam contradição entre números que
descrevem a mesma coisa):

- `stop_dolar` = `pontos_stop × valor_ponto(ativo) × contratos`
- `resultado_pontos` = `resultado ÷ (valor_ponto(ativo) × contratos)`
- `status` = `resultado > 0 → Gain` · `resultado < 0 → Loss` · `resultado = 0 → Zerado`

**Não existe duração.** Decisão explícita do usuário: o que interessa é o horário
real de entrada e de saída, exibidos como duas colunas (`Entrada` e `Saída`), não
quantos minutos a operação durou.

O `risco_retorno` vem **pré-calculado** (`resultado ÷ stop_dolar`) no formulário,
e o usuário pode sobrescrever pelo dropdown.

Fuso horário não é registrado — os horários são anotados no relógio que o usuário
usa. Uma análise futura de "resultado por horário do dia" vai exigir definir isso
antes.

### `estudos`
Prints do dia — o que aconteceu no gráfico, inclusive as entradas que estavam no
plano e não foram executadas. Substitui o antigo "Diário", com escopo menor.

`data` · `imagem_url` (Supabase Storage) · `ativo` · `tempo_grafico` · `observacao` (text)

**Só isso.** Sem setup, sem resultado, sem risco/retorno — estudo não é trade e
não entra em nenhuma estatística.

## 5. Telas

Menu lateral, nesta ordem: **Conta · Setup · Plano · Backteste · Perfomance · Estudos**.
No rodapé da barra lateral: **alternador de tema (claro/escuro)** e **Sair**.
Antes de tudo, a tela de **Login** (5.0).
Sem tela de Dashboard separada — Backteste e Perfomance abrem já no próprio painel.
O antigo **Diário** virou **Estudos do dia** (5.5), com escopo bem menor.

**Aviso de constância:** quando o usuário passa dias sem registrar nada (trade ou
estudo), aparece uma faixa discreta no topo da Perfomance e dos Estudos: *"Faz N
dias que você não registra nada no AION."* Some assim que algo é registrado. É
lembrete, não alarme — sem cor de erro, sem bloqueio.

### 5.0 Login

Tela cheia com o degradê de fundo, marca AION centralizada (arco no acento, nome com
`letter-spacing` largo, tagline "ciclos · tempo · consistência") e um card de 428px
com e-mail, senha, "manter conectado" e o botão Entrar.

**Não existe "criar conta".** São três usuários e as contas são criadas manualmente
no painel do Supabase. O rodapé diz isso explicitamente. Autenticação via Supabase
Auth (e-mail + senha). Logout volta para esta tela.

### 5.1 Conta

CRUD simples: número, tipo, moeda, saldo inicial, MLPT, marcar como padrão.
Ações: editar, remover. Sem filtros.

### 5.2 Backteste

**Tela inicial — lista fixa dos 7 tempos gráficos** (não é cadastro; não existe
"criar bloco"). Ordenada do menor tempo gráfico para o maior. Cada linha mostra:
tempo gráfico · quantidade de backtestes · assertividade · risco retorno médio.

Cards no topo: **Total de backtestes** · **Assertividade geral** · **Risco retorno geral**.

**Ao clicar num tempo gráfico** abre a listagem das linhas daquele tempo gráfico.

- `tempo_grafico` já vem preenchido no cadastro de nova linha.
- Ordenação: mais recentes primeiro.
- Filtro: por setup.
- Cards no topo, respeitando os filtros ativos: **Quantidade** · **Assertividade** · **Risco retorno**.
- Ações por linha: **Editar · Remover**. **Não existe duplicar** — decisão explícita
  do usuário: preencher do zero é parte do aprendizado, duplicar atrapalha a memorização.
- Listagem mostra todas as colunas do cadastro (16), com rolagem horizontal.
  **Número da linha e Data ficam fixos** à esquerda ao rolar.
- **Paginação: 20 registros por página**, só na tabela. Os cards do topo e a
  análise de contexto continuam olhando para o recorte inteiro do filtro, não
  para a página visível — só a listagem é paginada. O número da linha (`#`) é
  a posição no recorte completo, não reinicia a cada página.

**Abaixo da tabela — análise de contexto** (quatro cards):

1. **Melhores contextos** e 2. **Piores contextos** — combinações de
   `entrada` + `alinhamento` + `localizacao` ranqueadas.
3. **Assertividade por dimensão** — escolhe-se um campo (evento, localização, M20,
   M200, alinhamento, entrada, período, operação) e vê-se o gain/loss por valor.
4. **Matriz M20 × M200** — mapa de calor 3×3 cruzando as inclinações das médias.

**Os quatro cards respeitam o filtro de setup.** Sem setup selecionado, analisam
todos os registros do tempo gráfico; com setup selecionado, só os dele. É o mesmo
recorte dos cards do topo — a tela inteira fala do mesmo conjunto.

**Regra do ranking — não ordenar por percentual de acerto.** Um contexto com
1 registro e 100% não é melhor que um com 22 registros e 86%. Ordenar pelo
**limite inferior do intervalo de Wilson** (95%), exibido como "piso": é a
assertividade mínima que a amostra sustenta. Com 1 registro a 100% o piso é 20,7%;
com 22 registros a 86,4% o piso é 66,7% — a ordem se corrige sozinha.

- **Piso mínimo de amostra: 6 registros** para entrar em qualquer dos dois rankings.
  O que ficou de fora aparece no rodapé do card, explicando por quê.
- Nos **piores contextos** usar o limite **superior** de Wilson ("teto") — é dele
  que vem a confiança de que o contexto é ruim de verdade.
- Nunca exibir chave de tradução crua na tela.

**Cadastro é inline, na própria tabela** — não existe janela de cadastro no
backteste. A primeira linha da tabela é a linha de entrada, marcada por uma barra
ciano à esquerda: os campos aparecem como select/input dentro das próprias células,
e um botão de check salva. O `tempo_grafico` já vem do bloco; **o Setup começa
sempre vazio**, mesmo com filtro ativo.

**Sem atalhos de teclado** — nada de Ctrl+Enter ou navegação por teclas. Decisão
explícita do usuário: o fluxo é mouse.

### 5.3 Perfomance

Abre já no painel, com a **conta padrão** pré-selecionada e um seletor no topo para
trocar de conta. **Tudo na tela é sempre de uma conta por vez** — inclusive os cards.

Cards:

| Card | Cálculo |
|---|---|
| Saldo atual | `saldo_inicial + soma(resultado)` |
| Quantidade de trades | `count(*)` |
| Assertividade | `Gain ÷ (Gain + Loss) × 100` — **Zerado fica fora do denominador** |
| Meta para saque | `meta − (saldo_atual − saldo_inicial)` = quanto falta; com barra de progresso |
| Drawdown do pico | maior queda desde o topo do saldo, com barra de consumo do limite |
| Sequência atual | gains ou losses consecutivos, com os últimos 10 trades em faixas |
| Risco retorno médio | `avg(risco_retorno)` — é a expectativa em R por trade |
| Média de ganho | `avg(resultado)` onde `resultado > 0` |
| Média de perda | `avg(resultado)` onde `resultado < 0` |
| MLPT | valor cadastrado na conta selecionada |

Gráficos:

1. **Evolução acumulada da conta** — linha, saldo acumulado ao longo do tempo.
2. **Resultado por operação** — barras, uma por trade, com **linha de referência no
   MLPT** (e no MLPT negativo) para ver se cada trade está dentro do risco aceito.

3. **Calendário de consistência** — o mês em grade de dias úteis, cada dia tingido
   pelo resultado (diverging: perda ← neutro → ganho). Rodapé com dias positivos.
4. **Disciplina** — assertividade quando `respeitou_plano = true` contra `false`,
   em barras diretas rotuladas.

Os gráficos têm **eixos com valores visíveis** e **tooltip** ao passar o mouse,
mostrando resultado e saldo acumulado do ponto. A **meta da conta** aparece como
linha tracejada dourada no gráfico de evolução.

Na tela de Backteste há ainda a **distribuição de risco retorno** — histograma por
faixa de R:R, que revela concentração de saídas em 1:1 que a média esconde.

Filtros: setup, tempo gráfico. Ordenação: mais recentes primeiro.
Listagem: todas as colunas do cadastro mais as calculadas. Ações: editar, remover.

### 5.4 Setup

Cada setup é um **card** com foto, nome, e **duas linhas de estatística lado a lado**:

```
Backteste    68%   1.8R   142 registros
Real         54%   1.2R    23 trades
```

A diferença entre as duas linhas é a informação mais valiosa do app: mostra onde a
execução não está entregando o que o estudo prometeu.

Ordenação: **manual, por drag-and-drop** (campo `ordem`).
Ações: editar, remover, reordenar. Sem filtros. Nada mais é clicável.

### 5.5 Estudos do dia

Calendário do mês à esquerda com a **quantidade de estudos por dia**; galeria do dia
selecionado à direita, em cards de duas colunas. Cada card mostra a imagem grande,
os chips de ativo e tempo gráfico, e a observação.

Serve para registrar o print do dia — principalmente **as entradas que estavam no
plano e não foram executadas**. Ações: editar, remover.

### 5.6 Plano

Transcrição do plano de trade do usuário, em duas partes.

**1. Pré-mercado** (um card, quatro blocos):
- **Gerenciamento** — MLPT e MLPD, **lidos da conta selecionada**, nunca digitados aqui
- **Ativos** — chips dos ativos que o plano autoriza
- **Regras** — lista (janela operacional, mínimo/máximo de trades, encerrar após N
  losses seguidos, distância de notícia, etc.)
- **Checklists** de abertura e de fechamento, com caixas marcáveis

**2. Execução** — um card por setup, com os seis campos do `setups`:
Evento/gatilho · Adição · Localização · Stop inicial · Realização de lucros ·
Gestão de stop. Editados no setup, exibidos aqui.

**Impressão:** o botão *Imprimir* monta tudo numa folha **A4 paisagem única**, com
o pré-mercado numa coluna à esquerda e a execução como tabela de 6 colunas × N
setups à direita — o mesmo desenho do PDF que o usuário já usa.

**Edição — duas telas, porque o plano tem duas naturezas:**

- **Editar pré-mercado** (o registro `plano`): janela operacional, mínimo/máximo de
  trades, encerrar após N losses, ativos autorizados (chips liga/desliga), e três
  listas editáveis — regras, checklist de abertura, checklist de fechamento — cada
  item com arrastar para reordenar, editar no lugar e remover. Mais a frase de
  rodapé. O bloco de gerenciamento aparece **só leitura**, com link para a Conta.
- **Editar setup**: nome, descrição, imagem e os seis campos de execução. É aqui
  que o plano de cada setup é cadastrado. **Campo vazio não aparece no plano** —
  nem na tela nem na impressão.

**Sobre BT/TT:** aparecem no plano do usuário como confirmação, mas **não entram no
enum `evento`** — decisão explícita: o valor `Tail` já engloba os dois.

## 6. Regras que não podem ser violadas

- **Assertividade nunca inclui trades zerados no denominador.**
- **Estatística de backteste e de trade real nunca são somadas num número único.**
  Backteste tende a acertar mais que execução real, e misturar infla o número.
- **Nenhum número derivável é digitado duas vezes** (stop em dólar, resultado em
  pontos, duração, gain/loss). Digitar duas vezes é convidar contradição.
- **`risco_retorno` é numérico.** Foi armazenado como texto no Bubble e isso
  impediu qualquer média — não repetir.
- Divisão por zero ou lista vazia exibe `—`, nunca `NaN` nem `0%`.
- **Saque e aporte entram no saldo e saem de tudo o mais** — drawdown, MLPD e
  qualquer estatística de performance usam apenas `trades`.
- **MLPT e MLPD têm uma única fonte: a conta.** O Plano lê, não guarda cópia.

## 7. Identidade visual

Densidade alta, cantos arredondados, cards com fio translúcido e sem cor sólida
na borda.

**Tipografia:** `Bricolage Grotesque` (700) em títulos e na marca — display com
terminais irregulares, dá personalidade sem competir com a tabela. `Inter` em toda
a interface, corpo em **15px**. `JetBrains Mono` com `tabular-nums` em **todo
número**, sem exceção.

**Paleta — modo escuro (carvão quente e latão):**

| Papel | Cor |
|---|---|
| Fundo | degradê `#14120D` → `#2C2718` |
| Card | `#221E17` |
| Poço (tabelas, gráficos) | `#1A1710` |
| Elevado (botão, linha de cadastro, tooltip) | `#2C2820` |
| Input | `#131009` |
| Fios | `rgba(255,238,208, .08–.30)` — creme, nunca branco puro |
| Texto | `#F6F1E7` · `#DCD3C2` · `#A79C89` (rótulo) · `#7E7462` (fraco) |
| Acento | `#6A5AE0` (preenchimento) · `#A99BFF` (marcas, linhas, texto de acento) |
| Ganho | `#9BF7CE` |
| Perda | `#EC6C82` |

**Paleta — modo claro (papel quente):** fundo `#FCF9F2` → `#E9E2D2`; card `#FFFDF8`
com sombra suave; poço `#F5F1E7`; cabeçalho de tabela `#F0EADB`; tinta `#241E12` ·
`#4A4230` · `#7A6F58` · `#948A72`; acento de preenchimento igual (`#6A5AE0`),
acento de texto escurecido para `#4A3CC4`; **ganho `#064D3B`, perda `#E24A64`**.

**Cinco regras que a paleta impõe:**

1. **Acento frio sobre fundo quente.** O par carvão quente + violeta é o que faz a
   tela parecer desenhada. Um acento metálico (dourado, latão) foi testado e
   descartado: puxava a identidade para "corretora".
2. **Sobre `#6A5AE0` o texto é branco** (5:1). Diferente do latão, o violeta
   também funciona como texto sobre o card na versão clara `#A99BFF` (7:1).
3. **Ganho e perda separam-se por LUMINOSIDADE, não por matiz.** Um par
   verde/vermelho de mesma luminosidade tem ΔE ≈ 2 sob deuteranopia — ganho e perda
   viram a mesma cor para ~8% dos homens. No escuro: menta clara × rosa fundo
   (ΔE 20,7). No claro inverte: verde fundo × vermelho claro (ΔE 13,8).
   **Validar qualquer troca com um simulador de daltonismo, não no olho.**
4. **Poços são mais fundos que o card.** É onde ganho e perda ganham contraste.
5. **Fios de borda são creme translúcido**, não branco: num fundo quente, branco
   puro lê como azulado.

**Marca:** arco circular com seta (ciclo), no acento claro. AION com `letter-spacing`
de `0.20em` (`0.26em` na tela de login).

## 8. Em aberto

- Segunda fonte e direção visual.
- Análise por horário do dia exige definir fuso de registro (ver seção 4).
