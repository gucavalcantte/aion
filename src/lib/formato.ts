import type { Moeda } from "./ativos";

/** Nulo vira travessão. Nunca NaN, nunca 0% onde não há dado. */
export const VAZIO = "—";

const moedaBR = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inteiroBR = new Intl.NumberFormat("pt-BR");

const SIMBOLO: Record<Moeda, string> = { USD: "$", BRL: "R$" };

/** Símbolo de moeda isolado — usado onde o valor já vem formatado por fora (eixos de gráfico). */
export function simboloDaMoeda(moedaConta: Moeda): string {
  return SIMBOLO[moedaConta];
}

export function moeda(valor: number | null | undefined, moedaConta: Moeda, comSinal = false) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return VAZIO;
  const sinal = comSinal && valor > 0 ? "+" : valor < 0 ? "-" : "";
  return `${sinal}${SIMBOLO[moedaConta]}${moedaBR.format(Math.abs(valor))}`;
}

export function inteiro(valor: number | null | undefined) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return VAZIO;
  return inteiroBR.format(valor);
}

export function percentual(valor: number | null | undefined, casas = 1) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return VAZIO;
  return `${valor.toFixed(casas).replace(".", ",")}%`;
}

/** Risco/retorno sempre com sinal: o sinal é a informação. */
export function emR(valor: number | null | undefined) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return VAZIO;
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toFixed(2).replace(".", ",")}R`;
}

export function data(iso: string | null | undefined) {
  if (!iso) return VAZIO;
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function hora(valor: string | null | undefined) {
  if (!valor) return VAZIO;
  return valor.slice(0, 5);
}
