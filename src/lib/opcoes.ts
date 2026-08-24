/** Os enums do banco, na ordem em que aparecem na tela. */

export const TEMPOS_GRAFICOS = ["1m", "2m", "3m", "5m", "15m", "60m", "1D"] as const;
export const PERIODOS = ["Manhã", "Tarde", "Noite"] as const;
export const OPERACOES = ["Compra", "Venda"] as const;
export const EVENTOS = ["Barra elefante", "Tail", "180", "Troca de cor"] as const;
export const ENTRADAS = ["Confirmada", "Antecipada"] as const;
export const INCLINACOES = ["Plana", "Inclinada para cima", "Inclinada para baixo"] as const;
export const ALINHAMENTOS = ["Lateral", "Contra a tendência", "A favor da tendência"] as const;
export const LOCALIZACOES = [
  "Encostado na M20",
  "Próximo à M20",
  "Longe da M20",
  "Encostado na M20 e M200",
] as const;
export const RESULTADOS = ["Gain", "Loss"] as const;

/**
 * Risco/retorno é dropdown na tela e numeric no banco.
 * LOSS grava -1 — é isso que faz a média deste campo ser a expectativa em R.
 */
export const RISCO_RETORNO = [
  { rotulo: "LOSS", valor: -1 },
  { rotulo: "0,5:1", valor: 0.5 },
  { rotulo: "0,66:1", valor: 0.66 },
  { rotulo: "1:1", valor: 1 },
  { rotulo: "1,5:1", valor: 1.5 },
  { rotulo: "2:1", valor: 2 },
  { rotulo: "3:1", valor: 3 },
  { rotulo: "4:1 ou mais", valor: 4 },
] as const;

export function rotuloRiscoRetorno(valor: number | null | undefined) {
  if (valor === null || valor === undefined) return "—";
  return RISCO_RETORNO.find((r) => r.valor === valor)?.rotulo ?? String(valor);
}

export function ehTempoGrafico(v: string): v is (typeof TEMPOS_GRAFICOS)[number] {
  return (TEMPOS_GRAFICOS as readonly string[]).includes(v);
}

/**
 * Rótulos curtos para a tabela de backteste.
 * "Inclinada para baixo" ocupa 205px de coluna; "Inclinada ↓" ocupa 128.
 * Com 16 colunas, essa diferença decide se a tela rola 400px ou 1300px.
 * O valor gravado no banco continua sendo o longo.
 */
const CURTOS: Record<string, string> = {
  "Inclinada para cima": "Inclinada ↑",
  "Inclinada para baixo": "Inclinada ↓",
  "Contra a tendência": "Contra",
  "A favor da tendência": "A favor",
  "Encostado na M20": "Encostado M20",
  "Próximo à M20": "Próximo M20",
  "Longe da M20": "Longe M20",
  "Encostado na M20 e M200": "Encostado M20+M200",
};

export function curto(valor: string) {
  return CURTOS[valor] ?? valor;
}
