/**
 * Constante da aplicação — não é tabela, não é editável pelo usuário.
 * Ver CLAUDE.md, seção 3.2.
 */

export const ATIVOS = [
  { codigo: "MES", nome: "S&P", valorPonto: 5, unidade: "pontos", moeda: "USD" },
  { codigo: "MYM", nome: "Dow", valorPonto: 0.5, unidade: "pontos", moeda: "USD" },
  { codigo: "MNQ", nome: "Nasdaq", valorPonto: 2, unidade: "pontos", moeda: "USD" },
  { codigo: "MGC", nome: "Gold", valorPonto: 10, unidade: "pontos", moeda: "USD" },
  // MCL é pensado em %: 1% = 1,00 de movimento = $100 por contrato.
  { codigo: "MCL", nome: "Oil", valorPonto: 100, unidade: "%", moeda: "USD" },
  { codigo: "MBT", nome: "Bitcoin", valorPonto: 0.1, unidade: "pontos", moeda: "USD" },
  { codigo: "WIN", nome: "Mini Índice", valorPonto: 0.2, unidade: "pontos", moeda: "BRL" },
] as const;

export type Ativo = (typeof ATIVOS)[number]["codigo"];
export type Moeda = (typeof ATIVOS)[number]["moeda"];

const PORCODIGO = new Map(ATIVOS.map((a) => [a.codigo, a]));

export function ativo(codigo: Ativo) {
  const a = PORCODIGO.get(codigo);
  if (!a) throw new Error(`Ativo desconhecido: ${codigo}`);
  return a;
}

export function valorPonto(codigo: Ativo): number {
  return ativo(codigo).valorPonto;
}

/** O rótulo do campo de stop muda conforme o ativo: pontos, dólares ou %. */
export function unidadeDoStop(codigo: Ativo): string {
  return ativo(codigo).unidade;
}

/** WIN é o único ativo em BRL — os outros seis negociam em USD. */
export function moedaDoAtivo(codigo: Ativo): Moeda {
  return ativo(codigo).moeda;
}
