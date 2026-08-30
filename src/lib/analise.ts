/**
 * Análise de contexto do backteste.
 *
 * A regra que governa este arquivo: NUNCA ordenar por percentual de acerto.
 * Um contexto com 1 registro e 100% não é melhor que um com 22 e 86%. Os
 * melhores saem pelo limite INFERIOR de Wilson (o "piso"), e os piores pelo
 * limite SUPERIOR (o "teto") — é dele que vem a confiança de que o contexto é
 * ruim de verdade, e não azar de amostra curta.
 */

import { AMOSTRA_MINIMA, assertividade, pisoDeConfianca, riscoRetornoMedio, tetoDeConfianca } from "./metricas";

export type LinhaAnalisavel = {
  entrada: string;
  alinhamento: string;
  localizacao: string;
  m20: string;
  m200: string;
  evento: string;
  periodo: string;
  operacao: string;
  ativo: string;
  resultado: "Gain" | "Loss";
  risco_retorno: number;
};

export type Grupo = {
  chave: string;
  registros: number;
  gains: number;
  assertividade: number;
  piso: number;
  teto: number;
  riscoRetorno: number | null;
};

function agrupar<T extends LinhaAnalisavel>(linhas: T[], chave: (l: T) => string): Grupo[] {
  const mapa = new Map<string, T[]>();
  for (const l of linhas) {
    const k = chave(l);
    mapa.set(k, [...(mapa.get(k) ?? []), l]);
  }

  return [...mapa.entries()].map(([k, itens]) => {
    const gains = itens.filter((i) => i.resultado === "Gain").length;
    return {
      chave: k,
      registros: itens.length,
      gains,
      assertividade: assertividade(gains, itens.length - gains) ?? 0,
      piso: pisoDeConfianca(gains, itens.length) ?? 0,
      teto: tetoDeConfianca(gains, itens.length) ?? 100,
      // Só os gains entram — o R:R do contexto é "quanto paga quando acerta", não a expectativa.
      riscoRetorno: riscoRetornoMedio(
        itens.filter((i) => i.resultado === "Gain").map((i) => i.risco_retorno),
      ),
    };
  });
}

export type Contexto = Grupo & { entrada: string; alinhamento: string; localizacao: string };

const SEPARADOR = " ⋮ ";

/** A combinação que o card mostra: entrada + alinhamento + localização. */
export function contextos(linhas: LinhaAnalisavel[]) {
  const grupos = agrupar(linhas, (l) => [l.entrada, l.alinhamento, l.localizacao].join(SEPARADOR));

  const completos: Contexto[] = grupos.map((g) => {
    const [entrada, alinhamento, localizacao] = g.chave.split(SEPARADOR);
    return { ...g, entrada, alinhamento, localizacao };
  });

  const comAmostra = completos.filter((c) => c.registros >= AMOSTRA_MINIMA);

  return {
    melhores: [...comAmostra].sort((a, b) => b.piso - a.piso).slice(0, 4),
    piores: [...comAmostra].sort((a, b) => a.teto - b.teto).slice(0, 3),
    // Fica de fora do ranking, mas o card diz por quê — senão parece bug.
    curtos: completos
      .filter((c) => c.registros < AMOSTRA_MINIMA)
      .sort((a, b) => b.assertividade - a.assertividade)
      .slice(0, 1),
  };
}

export const DIMENSOES = [
  { chave: "evento", rotulo: "Evento" },
  { chave: "localizacao", rotulo: "Localização" },
  { chave: "m20", rotulo: "M20" },
  { chave: "m200", rotulo: "M200" },
  { chave: "alinhamento", rotulo: "Alinhamento" },
  { chave: "entrada", rotulo: "Entrada" },
  { chave: "periodo", rotulo: "Período" },
  { chave: "operacao", rotulo: "Operação" },
  { chave: "ativo", rotulo: "Ativo" },
] as const;

export type Dimensao = (typeof DIMENSOES)[number]["chave"];

export function porDimensao(linhas: LinhaAnalisavel[], dimensao: Dimensao) {
  return agrupar(linhas, (l) => String(l[dimensao])).sort(
    (a, b) => b.assertividade - a.assertividade,
  );
}

/** Cruzamento das duas médias: 3×3, o mapa mais específico do método. */
export function matrizDasMedias(linhas: LinhaAnalisavel[], eixos: readonly string[]) {
  return eixos.map((m20) =>
    eixos.map((m200) => {
      const celula = linhas.filter((l) => l.m20 === m20 && l.m200 === m200);
      const gains = celula.filter((l) => l.resultado === "Gain").length;
      return {
        m20,
        m200,
        registros: celula.length,
        assertividade: assertividade(gains, celula.length - gains),
      };
    }),
  );
}
