# Valor do ponto por corretora (Ylos × Zero Markets) — design

## Contexto

O AION trata o valor do ponto como constante de um ativo só: `MNQ = 2,00`,
ponto final (`src/lib/ativos.ts`). Isso era verdade enquanto todos os usuários
operavam na mesma corretora.

Não é mais. O dono opera na **Zero Markets**, a esposa na **Ylos**, e as duas
precificam o mesmo ativo de formas diferentes:

| Ativo | Ylos (1 contrato) | Zero (1,0 lote) | Lote Zero ≈ 1 contrato Ylos |
|---|---|---|---|
| MES | US$ 5,00 /pt | US$ 1,00 /pt | 5,00 |
| MYM | US$ 0,50 /pt | US$ 1,00 /pt | 0,50 |
| MNQ | US$ 2,00 /pt | US$ 1,00 /pt | 2,00 |
| MGC | US$ 10,00 /pt | US$ 100,00 /pt | 0,10 |
| MCL | US$ 100,00 /% | US$ 10,00 /pt | 0,10 |
| MBT | US$ 0,10 /pt | US$ 1,00 /pt | 0,10 |
| WIN | R$ 0,20 /pt | não existe | — |

Com a tabela de hoje, todo trade da Zero grava `stop_dolar` e
`resultado_pontos` errados — e por consequência o R:R sugerido no formulário
também. O `resultado` em si continua certo, porque é digitado em dólar.

## O caso do MCL

MCL é o único ativo cuja **unidade** muda de corretora, e isso quase virou um
problema de manutenção permanente.

Na Ylos o usuário anota o stop em "%", mas "1%" no vocabulário dele quer dizer
**1,00 de movimento do preço**: 100 barris × US$ 1,00 = US$ 100 por contrato.
É uma constante.

Na Zero a plataforma mostra percentual de verdade, sobre o preço do WTI. Dois
dados do usuário confirmam:

```
0,01  × 86,364 × 1000 barris        = 863,64   (WTI a 86,36)
0,002 × 90,00  × 1000 barris × 0,10 =  18,00   (WTI a 90,00)
```

Medido em %, o valor do ponto do MCL na Zero anda junto com o petróleo —
exigiria um campo de preço de referência mantido à mão, que envelhece calado.

**Decisão: na Zero, o MCL é medido em pontos, não em %.** Um ponto do WTI é um
centavo de preço; 1 lote são 1000 barris; logo `1000 × 0,01 = US$ 10 por ponto`,
**fixo**. Confere com o dado do usuário: `14 pontos × 0,10 lote = US$ 14`. E
confere com o caso anterior: `18 pontos × 10 × 0,10 = US$ 18`.

Isso elimina a dependência do preço, elimina o campo extra, e faz o MCL cair no
mesmo `0,10 lote ≈ 1 contrato` do MGC e do MBT — o `0,12` da tabela original era
só o arredondamento do 863,64.

**Consequência aceita:** o rótulo da unidade do MCL passa a depender da
corretora ("%" na Ylos, "pontos" na Zero). No Backteste, que não tem conta
vinculada, o rótulo segue a corretora da conta padrão — a mesma fonte que o
tooltip de contratos ideais já usa. Como cada usuário opera numa corretora só,
isso não conflita na prática. Se um dia alguém tiver contas nas duas, os stops
de MCL já registrados no backteste passam a ser lidos na unidade da conta padrão
vigente. É o preço de não guardar corretora no backteste, e é barato.

## Desenho

### 1. `corretora` é uma propriedade da conta

Enum novo `corretora` com dois valores: `Ylos`, `Zero Markets`. Coluna
`contas.corretora not null default 'Ylos'`.

O default é `Ylos` porque a tabela `ATIVOS` de hoje **é** a da Ylos — assim a
migração não altera o valor de nenhum trade já gravado.

### 2. O valor do ponto passa a ser função de `(corretora, ativo)`

`ativos.ts` se divide em duas coisas que hoje estão misturadas numa lista só:

- **Identidade do ativo** — código, nome, moeda. Não depende de corretora.
- **Ficha por corretora** — `valorPonto` e `unidade`. Depende das duas.

```
CORRETORAS: Ylos | Zero Markets

FICHA[corretora][ativo] = { valorPonto, unidade }
```

**Ativo ausente da ficha de uma corretora simplesmente não é oferecido.** É essa
regra que resolve o WIN na Zero sem inventar dado: WIN não existe lá, e some do
seletor. O filtro do formulário de trade, hoje só por moeda
(`formulario-trade.tsx:58`), passa a ser **moeda ∩ corretora**.

Assinaturas que mudam:

- `valorPonto(ativo, corretora)`
- `unidadeDoStop(ativo, corretora)`
- `stopEmDolar(pontosStop, ativo, contratos, corretora)`
- `resultadoEmPontos(resultado, ativo, contratos, corretora)`
- nova: `ativosDaCorretora(corretora)`
- nova: `unidadeDaQuantidade(corretora)` → `"contratos"` | `"lotes"`
- `moedaDoAtivo(ativo)` — **não muda**, a moeda é da bolsa, não da corretora

### 3. Lote fracionário

Na Zero o tamanho é fracionado: 0,10 lote no MGC, 0,10 no MCL.
`trades.contratos` sai de `integer` para `numeric(10,2)`.

No servidor (`perfomance/acoes.ts:62`) some o `Math.round(contratos)`, e a
validação `contratos < 1` vira `contratos <= 0`. O `check (contratos > 0)` do
banco continua valendo sem alteração.

O rótulo do campo passa a ser **"Contratos"** em conta Ylos e **"Lotes"** em
conta Zero — mesma mecânica do rótulo de stop, que já muda por ativo. O
`inputMode` do campo vira `decimal`.

### 4. As colunas geradas: `trades.corretora` por trigger

`stop_dolar` e `resultado_pontos` são `GENERATED ALWAYS ... STORED`
(`0001_schema.sql:192`), e **uma coluna gerada não pode ler outra tabela** — não
há como buscar a corretora via `conta_id`.

**Solução escolhida: desnormalizar.** `trades.corretora`, preenchida por trigger
`before insert or update of conta_id` a partir da conta. As colunas geradas
continuam existindo e continuam impossíveis de contradizer, e nenhuma query de
leitura muda (todas usam `select("*")`).

Alternativas descartadas:

- **View com join em `contas`** — sem redundância e sem trigger, mas o histórico
  inteiro recalcularia se uma conta trocasse de corretora.
- **Calcular só no app, em `metricas.ts`** — viola a decisão explícita do
  `0001_schema.sql`: campos deriváveis são GENERATED justamente para não poderem
  ficar inconsistentes.

O trigger dispara **só** em `insert` e em `update of conta_id`. Duas
consequências desejadas: um trade guarda a corretora onde foi executado, mesmo
que a conta mude depois; e um `update trades set corretora = ...` direto no SQL
continua possível, que é o que o §7 precisa.

Constraint nova, para o caso de ativo sem ficha na corretora:

```sql
constraint trades_ativo_da_corretora check (valor_do_ponto(ativo, corretora) is not null)
```

### 5. Backteste

`mlptDaContaPadrao()` (`dados/contas.ts:52`) vira `referenciaDaContaPadrao()`,
devolvendo `{ mlpt, corretora }`. A `TabelaBackteste` recebe os dois e usa a
corretora para:

- o rótulo da unidade do stop (`tabela.tsx:263`, `:353`, `:634`);
- o valor do ponto no tooltip de dimensionamento (`tabela.tsx:617`);
- o rótulo "contratos"/"lotes" no mesmo tooltip.

Se o ativo do backteste não existe na corretora da conta padrão (WIN com conta
Zero), o tooltip não aparece — que já é o comportamento atual quando falta dado.

### 6. Conta

O formulário ganha o seletor de corretora, ao lado do de moeda, e `acoes.ts`
valida o valor. `Conta` em `tipos.ts` ganha o campo.

### 7. Backfill dos trades já registrados

Se já existem trades da Zero gravados com os valores da Ylos, a migração precisa
de um passo manual depois de marcar a conta:

```sql
update public.trades set corretora = 'Zero Markets' where conta_id = '<id da conta>';
```

`stop_dolar` e `resultado_pontos` se recalculam sozinhos (são gerados).
**`risco_retorno` não** — ele foi gravado a partir de uma sugestão calculada com
o valor errado, e é um campo que o usuário pode sobrescrever à mão. Corrigi-lo
em massa apagaria escolhas manuais. Fica como conferência do usuário, trade a
trade, se ele quiser.

**A confirmar com o usuário:** existem trades assim?

### 8. O que não muda

- **Setup (§5.4)** e toda a estatística: assertividade e R:R são percentuais e
  razões, imunes ao valor do ponto.
- **Plano**: MLPT e MLPD já vêm da conta. Os chips de ativos autorizados
  continuam livres — o plano é um registro por usuário e não tem conta.
- **Backtestes**: nenhuma coluna nova. O bloco continua sendo só o tempo gráfico.
- **`moedaDoAtivo`**: WIN é BRL porque negocia na B3, não por causa da corretora.

## Migração (`0003_corretora.sql`)

Ordem obrigatória — as colunas geradas dependem tanto de `contratos` quanto de
`valor_do_ponto`, então precisam cair antes das duas mudarem:

1. `create type corretora as enum ('Ylos', 'Zero Markets')`
2. `alter table contas add column corretora ... default 'Ylos'`
3. `drop column stop_dolar`, `drop column resultado_pontos`
4. `drop function valor_do_ponto(ativo)`
5. `create function valor_do_ponto(ativo, corretora)` — `null` para WIN na Zero
6. `alter table trades add column corretora`, backfill a partir de `contas`,
   `set not null`
7. `alter table trades alter column contratos type numeric(10,2)`
8. recriar as duas colunas geradas usando `valor_do_ponto(ativo, corretora)`
9. criar a função e o trigger `before insert or update of conta_id`
10. adicionar a constraint `trades_ativo_da_corretora`

**Roda de uma vez só**, diferente do `0002`: a restrição do Postgres é sobre
`alter type ... add value`, não sobre `create type`. Um enum recém-criado pode
ter seus valores usados na mesma transação.

## Verificação

`metricas.check.ts` ganha casos que fixam as decisões deste documento:

- `valorPonto("MNQ", "Ylos") === 2` e `valorPonto("MNQ", "Zero Markets") === 1`
- `valorPonto("MCL", "Zero Markets") === 10` e
  `unidadeDoStop("MCL", "Zero Markets") === "pontos"`
- `unidadeDoStop("MCL", "Ylos") === "%"`
- `stopEmDolar(14, "MCL", 0.10, "Zero Markets") === 14` — o dado que o usuário deu
- `stopEmDolar(18, "MCL", 0.10, "Zero Markets") === 18` — o caso do 0,20% a WTI 90
- `ativosDaCorretora("Zero Markets")` não inclui WIN
- `moedaDoAtivo("WIN") === "BRL"` em qualquer corretora

## Discrepância pré-existente, fora de escopo

`CLAUDE.md` §3.2 diz que a unidade de MGC e MBT é **"dólares"**; `ativos.ts:10` e
`:13` gravam **"pontos"**. Este design não resolve isso — preserva o que o código
faz hoje e apenas move o campo de lugar. Vale uma decisão à parte.
