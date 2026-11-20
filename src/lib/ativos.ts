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

/** Código do ativo no cadastro do usuário (ex.: "MES"). Cada usuário cadastra os seus. */
export type Ativo = string;
export type Moeda = "USD" | "BRL";

const PORCODIGO = new Map<string, (typeof ATIVOS)[number]>(ATIVOS.map((a) => [a.codigo, a]));

export function ativo(codigo: Ativo) {
  const a = PORCODIGO.get(codigo);
  if (!a) throw new Error(`Ativo desconhecido: ${codigo}`);
  return a;
}

/** WIN é o único ativo em BRL — os outros seis negociam em USD. */
export function moedaDoAtivo(codigo: Ativo): Moeda {
  return ativo(codigo).moeda;
}

/** Nome da corretora no cadastro do usuário (ex.: "Ylos"). */
export type Corretora = string;
