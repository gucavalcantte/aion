/**
 * Tipos de ativo, moeda e corretora. Ativos e corretoras são cadastros de cada
 * usuário (tabelas `ativos` e `corretoras`; ver src/lib/dados/) — não há mais
 * lista fixa no código. CLAUDE.md, seções 3.2 e 4.
 */

/** Código do ativo no cadastro do usuário (ex.: "MES"). */
export type Ativo = string;

/** Nome da corretora no cadastro do usuário (ex.: "Ylos"). */
export type Corretora = string;

export type Moeda = "USD" | "BRL";
