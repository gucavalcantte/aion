import type { TipoExecucao } from "./opcoes";

export type ExecucaoTrade = {
  id: string;
  tipo: TipoExecucao;
  quantidade: number;
  ordem: number;
  notas: string | null;
};

export type LinhaExecucao = {
  tipo: TipoExecucao;
  quantidade: number;
  notas: string | null;
};

export type FechamentoDeExecucoes = {
  alvo: number;
  somaSaida: number;
  falta: number;
  temSaida: boolean;
  fechado: boolean;
};

/**
 * `contratos` é a entrada inicial do trade. Adição aumenta o alvo a fechar;
 * Parcial e Saída do trade são o que fecha. Precisa existir ao menos uma
 * execução de Saída do trade — sem ela, sobra contrato aberto sem explicação.
 */
export function fechamentoDeExecucoes(contratos: number, linhas: LinhaExecucao[]): FechamentoDeExecucoes {
  const somaAdicao = linhas
    .filter((l) => l.tipo === "Adição")
    .reduce((a, l) => a + l.quantidade, 0);
  const somaSaida = linhas
    .filter((l) => l.tipo === "Parcial" || l.tipo === "Saída do trade")
    .reduce((a, l) => a + l.quantidade, 0);
  const alvo = contratos + somaAdicao;
  const temSaida = linhas.some((l) => l.tipo === "Saída do trade");

  return { alvo, somaSaida, falta: alvo - somaSaida, temSaida, fechado: temSaida && alvo === somaSaida };
}
