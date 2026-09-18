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
 * Corretora (ou mesa) da conta. Fechada nesses valores, como os demais enums
 * do app — uma corretora nova é uma migration, não um cadastro.
 */
export const CORRETORAS = ["Ylos", "ZeroMarkets", "Insinder", "Goat", "B3"] as const;
export type Corretora = (typeof CORRETORAS)[number];

/**
 * USD opera por Ylos, ZeroMarkets, Insinder ou Goat; BRL só tem B3 (única
 * praça do WIN). Insinder e Goat cobrem menos ativos que as demais (só o
 * lote micro de Ouro, Nasdaq e Dow) — a cobertura real vem das linhas de
 * `valores_ponto_corretora`, não daqui.
 */
export function corretorasPorMoeda(moeda: Moeda): Corretora[] {
  return moeda === "USD" ? ["Ylos", "ZeroMarkets", "Insinder", "Goat"] : ["B3"];
}
