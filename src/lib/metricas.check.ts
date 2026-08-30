/**
 * Conferência rápida das contas. Roda com:
 *   node --experimental-strip-types src/lib/metricas.check.ts
 * Não é suíte de teste — é o mínimo para não publicar conta errada.
 */

import {
  assertividade,
  disciplina,
  drawdownDoPico,
  pisoDeConfianca,
  progressoDaMeta,
  resultadoEmPontos,
  riscoRetornoMedio,
  saldoAtual,
  sequenciaAtual,
  statusDoResultado,
  stopEmDolar,
  tetoDeConfianca,
} from "./metricas";
import { moedaDoAtivo, valorPonto } from "./ativos";
import { moeda } from "./formato";

let falhas = 0;

function eq(nome: string, obtido: unknown, esperado: unknown) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  const ok = a === b;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : ` — obtido ${a}, esperado ${b}`}`);
}

const r2 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

// zerado fica fora do denominador
eq("assertividade 9 gain / 5 loss", r2(assertividade(9, 5)), 64.3);
eq("assertividade sem trades", assertividade(0, 0), null);

// LOSS = -1, então a média é a expectativa em R
eq("risco retorno médio", r2(riscoRetornoMedio([-1, 2, 3, -1])), 0.8);
eq("risco retorno de lista vazia", riscoRetornoMedio([]), null);

// campos calculados
eq("stop MNQ 12,5 pts × 3 contratos", stopEmDolar(12.5, "MNQ", 3), 75);
eq("stop MCL 0,18 × 1", stopEmDolar(0.18, "MCL", 1), 18);
eq("resultado em pontos", resultadoEmPontos(225, "MNQ", 3), 37.5);
eq("status de zerado", statusDoResultado(0), "Zerado");

// saque derruba o saldo
eq(
  "saldo com saque",
  saldoAtual(50000, [1000, -400, 2000], [{ tipo: "Saque", valor: 5000 }]),
  47600,
);

// e o progresso da meta cai junto, sozinho
eq(
  "meta após saque",
  progressoDaMeta(47600, 50000, 15000)?.percentual,
  -16,
);

// saque NÃO entra no drawdown
eq(
  "drawdown ignora lançamento",
  drawdownDoPico(50000, [1000, -400, 2000]),
  { atual: 0, maximo: 400 },
);

eq("sequência atual", sequenciaAtual([-1, 200, 300, 400]), {
  tipo: "Gain",
  quantidade: 3,
});

// disciplina: liga assertividade a resultado, com e sem respeitou_plano
eq("disciplina sem trades", disciplina([]), null);

eq(
  "disciplina: multiplicador e resultado fora do plano",
  (() => {
    const d = disciplina([
      { resultado: 100, respeitou_plano: true },
      { resultado: 100, respeitou_plano: true },
      { resultado: 100, respeitou_plano: true },
      { resultado: -50, respeitou_plano: true },
      { resultado: 50, respeitou_plano: false },
      { resultado: -100, respeitou_plano: false },
      { resultado: -100, respeitou_plano: false },
      { resultado: -100, respeitou_plano: false },
    ]);
    if (!d) return null;
    return [
      r2(d.comPlano.assertividade),
      r2(d.semPlano.assertividade),
      r2(d.multiplicador),
      d.resultadoFora,
    ];
  })(),
  [75, 25, 3, -250],
);

// sem gain fora do plano, a razão vira divisão por zero — mostra "—", não Infinity
eq(
  "disciplina: sem acerto fora do plano tem multiplicador nulo",
  disciplina([
    { resultado: 100, respeitou_plano: true },
    { resultado: -10, respeitou_plano: false },
  ])?.multiplicador,
  null,
);

// o ponto principal: 1 registro a 100% não vence 22 a 86%
eq("piso de 1/1  (100,0%)", r2(pisoDeConfianca(1, 1)), 20.7);
eq("piso de 3/4  (75,0%)", r2(pisoDeConfianca(3, 4)), 30.1);
eq("piso de 19/22 (86,4%)", r2(pisoDeConfianca(19, 22)), 66.7);
eq("piso de 12/14 (85,7%)", r2(pisoDeConfianca(12, 14)), 60.1);
eq("piso de 9/11 (81,8%)", r2(pisoDeConfianca(9, 11)), 52.3);
eq("piso de 7/9  (77,8%)", r2(pisoDeConfianca(7, 9)), 45.3);

// nos piores contextos a confiança vem do teto
eq("teto de 2/12 (16,7%)", r2(tetoDeConfianca(2, 12)), 44.8);
eq("teto de 2/8  (25,0%)", r2(tetoDeConfianca(2, 8)), 59.1);
eq("teto de 2/7  (28,6%)", r2(tetoDeConfianca(2, 7)), 64.1);

// WIN entrou como ativo em BRL — os outros seis continuam em USD
eq("valor do ponto do WIN", valorPonto("WIN"), 0.2);
eq("moeda nativa do WIN", moedaDoAtivo("WIN"), "BRL");
eq("moeda nativa do MES", moedaDoAtivo("MES"), "USD");

// moeda() exige a moeda — símbolo muda, formatação decimal não
eq("moeda em dólar", moeda(1234.5, "USD"), "$1.234,50");
eq("moeda em real", moeda(1234.5, "BRL"), "R$1.234,50");
eq("moeda negativa com sinal", moeda(-50, "USD", true), "-$50,00");
eq("moeda vazia", moeda(null, "USD"), "—");

console.log(falhas === 0 ? "\ntudo certo" : `\n${falhas} falha(s)`);
if (falhas > 0) process.exit(1);
