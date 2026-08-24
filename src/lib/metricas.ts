/**
 * As regras da seção 6 do CLAUDE.md, em código.
 *
 * Duas convenções que valem para o arquivo inteiro:
 *
 * 1. Toda função devolve `null` quando não há dado suficiente. Quem exibe
 *    traduz `null` para "—". Nunca NaN, nunca 0%.
 * 2. Nada aqui conhece banco de dados. São funções puras sobre números, para
 *    poderem ser testadas sem subir nada.
 */

import { valorPonto, type Ativo } from "./ativos";

export type Status = "Gain" | "Loss" | "Zerado";

/* -------------------------------------------------------------------------
   Campos calculados do trade — os que nunca se digitam
------------------------------------------------------------------------- */

export function statusDoResultado(resultado: number): Status {
  if (resultado > 0) return "Gain";
  if (resultado < 0) return "Loss";
  return "Zerado";
}

export function stopEmDolar(
  pontosStop: number,
  ativo: Ativo,
  contratos: number,
): number {
  return pontosStop * valorPonto(ativo) * contratos;
}

export function resultadoEmPontos(
  resultado: number,
  ativo: Ativo,
  contratos: number,
): number | null {
  const divisor = valorPonto(ativo) * contratos;
  if (divisor === 0) return null;
  return resultado / divisor;
}

/** Sugestão que o formulário mostra pré-preenchida; o usuário pode sobrescrever. */
export function riscoRetornoSugerido(
  resultado: number,
  stopDolar: number,
): number | null {
  if (stopDolar === 0) return null;
  return resultado / stopDolar;
}

/* -------------------------------------------------------------------------
   Estatística
------------------------------------------------------------------------- */

/**
 * Assertividade nunca inclui trades zerados no denominador.
 * Um breakeven não é derrota — contá-lo como tal afunda a estatística.
 */
export function assertividade(gains: number, losses: number): number | null {
  const total = gains + losses;
  if (total === 0) return null;
  return (gains / total) * 100;
}

/**
 * A média de risco/retorno é a expectativa em R por operação, porque LOSS
 * está gravado como -1. Positiva = ganha dinheiro no agregado.
 */
export function riscoRetornoMedio(valores: number[]): number | null {
  const v = valores.filter((n) => Number.isFinite(n));
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function mediaDeGanho(resultados: number[]): number | null {
  const v = resultados.filter((r) => r > 0);
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function mediaDePerda(resultados: number[]): number | null {
  const v = resultados.filter((r) => r < 0);
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** Gains ou losses consecutivos do fim para trás. Zerado interrompe a contagem. */
export function sequenciaAtual(
  resultadosEmOrdem: number[],
): { tipo: Status; quantidade: number } | null {
  if (resultadosEmOrdem.length === 0) return null;
  const tipo = statusDoResultado(resultadosEmOrdem[resultadosEmOrdem.length - 1]);
  if (tipo === "Zerado") return { tipo, quantidade: 1 };

  let quantidade = 0;
  for (let i = resultadosEmOrdem.length - 1; i >= 0; i--) {
    if (statusDoResultado(resultadosEmOrdem[i]) !== tipo) break;
    quantidade++;
  }
  return { tipo, quantidade };
}

/* -------------------------------------------------------------------------
   Saldo, meta e drawdown

   Saque e aporte entram no saldo e saem de tudo o mais. Um saque de $5.000
   não é uma perda de $5.000 — se entrasse no drawdown, "estouraria" o limite
   da conta sem você ter perdido nada.
------------------------------------------------------------------------- */

export type Lancamento = { tipo: "Saque" | "Aporte"; valor: number };

export function saldoAtual(
  saldoInicial: number,
  resultadosDosTrades: number[],
  lancamentos: Lancamento[] = [],
): number {
  const operacional = resultadosDosTrades.reduce((a, b) => a + b, 0);
  const movimento = lancamentos.reduce(
    (a, l) => a + (l.tipo === "Aporte" ? l.valor : -l.valor),
    0,
  );
  return saldoInicial + operacional + movimento;
}

export function progressoDaMeta(
  saldoAtualValor: number,
  saldoInicial: number,
  meta: number | null,
): { lucro: number; falta: number; percentual: number } | null {
  if (meta === null || meta <= 0) return null;
  const lucro = saldoAtualValor - saldoInicial;
  return {
    lucro,
    falta: Math.max(0, meta - lucro),
    percentual: (lucro / meta) * 100,
  };
}

/**
 * Maior queda desde o topo, calculada sobre a série SÓ DE OPERAÇÕES.
 * Lançamentos ficam de fora de propósito.
 */
export function drawdownDoPico(
  saldoInicial: number,
  resultadosEmOrdem: number[],
): { atual: number; maximo: number } {
  let saldo = saldoInicial;
  let pico = saldoInicial;
  let maximo = 0;

  for (const r of resultadosEmOrdem) {
    saldo += r;
    if (saldo > pico) pico = saldo;
    const queda = pico - saldo;
    if (queda > maximo) maximo = queda;
  }
  return { atual: pico - saldo, maximo };
}

/* -------------------------------------------------------------------------
   Confiança — o que impede o app de recomendar ruído

   Ordenar contexto por percentual de acerto coloca 1 registro a 100% acima de
   22 registros a 86%. O limite inferior de Wilson resolve: com 1 registro a
   100% o piso é 20,7%; com 22 a 86,4% o piso é 66,7%.
------------------------------------------------------------------------- */

const Z = 1.96; // 95%

function wilson(gains: number, total: number, lado: -1 | 1): number | null {
  if (total <= 0) return null;
  const p = gains / total;
  const z2 = Z * Z;
  const centro = p + z2 / (2 * total);
  const margem =
    Z * Math.sqrt(p * (1 - p) / total + z2 / (4 * total * total));
  const valor = (centro + lado * margem) / (1 + z2 / total);
  return Math.min(1, Math.max(0, valor)) * 100;
}

/** Piso: a assertividade mínima que a amostra sustenta. Ordena os melhores. */
export function pisoDeConfianca(gains: number, total: number): number | null {
  return wilson(gains, total, -1);
}

/** Teto: o máximo que a amostra admite. É dele que vem a certeza sobre os piores. */
export function tetoDeConfianca(gains: number, total: number): number | null {
  return wilson(gains, total, 1);
}

/** Piso de amostra para um contexto entrar em qualquer dos dois rankings. */
export const AMOSTRA_MINIMA = 6;
