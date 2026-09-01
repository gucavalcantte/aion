/**
 * Constante da aplicação — não é tabela, não é editável pelo usuário.
 * Ver CLAUDE.md, seção 3.2.
 *
 * Valor por ponto e unidade do stop NÃO estão aqui — variam por corretora
 * (ver src/lib/dados/corretoras.ts). Só nome e moeda são mesmo fixos do ativo.
 */

export const ATIVOS = [
  { codigo: "MES", nome: "S&P", moeda: "USD" },
  { codigo: "MYM", nome: "Dow", moeda: "USD" },
  { codigo: "MNQ", nome: "Nasdaq", moeda: "USD" },
  { codigo: "MGC", nome: "Gold", moeda: "USD" },
  { codigo: "MCL", nome: "Oil", moeda: "USD" },
  { codigo: "MBT", nome: "Bitcoin", moeda: "USD" },
  { codigo: "WIN", nome: "Mini Índice", moeda: "BRL" },
] as const;

export type Ativo = (typeof ATIVOS)[number]["codigo"];
export type Moeda = (typeof ATIVOS)[number]["moeda"];

const PORCODIGO = new Map(ATIVOS.map((a) => [a.codigo, a]));

export function ativo(codigo: Ativo) {
  const a = PORCODIGO.get(codigo);
  if (!a) throw new Error(`Ativo desconhecido: ${codigo}`);
  return a;
}

/** WIN é o único ativo em BRL — os outros seis negociam em USD. */
export function moedaDoAtivo(codigo: Ativo): Moeda {
  return ativo(codigo).moeda;
}

/**
 * Corretora da conta. Fechada nesses três valores, como os demais enums do
 * app — uma quarta corretora é uma migration, não um cadastro.
 */
export const CORRETORAS = ["Ylos", "ZeroMarkets", "B3"] as const;
export type Corretora = (typeof CORRETORAS)[number];

/** USD opera por Ylos ou ZeroMarkets; BRL só tem B3 (única praça do WIN). */
export function corretorasPorMoeda(moeda: Moeda): Corretora[] {
  return moeda === "USD" ? ["Ylos", "ZeroMarkets"] : ["B3"];
}
