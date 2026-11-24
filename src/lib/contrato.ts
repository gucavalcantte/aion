/**
 * Especificação de contrato em tick: funções puras, sem banco e sem React.
 * O valor por ponto nunca é digitado — sai do tamanho e do valor do tick
 * (CLAUDE.md, seção 6: nenhum número derivável é digitado duas vezes).
 */

import { UNIDADES } from "./opcoes";

/**
 * Lê um número digitado pelo usuário. Com vírgula, a vírgula é o decimal e os
 * pontos são separador de milhar ("1.250,5" → 1250.5). Sem vírgula, o ponto é
 * o decimal ("0.25" → 0.25). Vazio, texto ou mais de uma vírgula → null.
 */
export function lerNumero(texto: FormDataEntryValue | string | null | undefined): number | null {
  const bruto = String(texto ?? "").trim();
  if (!bruto) return null;

  const virgulas = bruto.split(",").length - 1;
  if (virgulas > 1) return null;

  const limpo = virgulas === 1 ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(limpo)) return null;

  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

const positivo = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;

const arredondar = (n: number) => Math.round(n * 1e8) / 1e8;

/** Valor de 1 ponto, em dinheiro: valor do tick ÷ tamanho do tick. */
export function valorPorPonto(tamanhoTick: number | null, valorTick: number | null): number | null {
  if (!positivo(tamanhoTick) || !positivo(valorTick)) return null;
  return valorTick / tamanhoTick;
}

export type ExemploTick = {
  ticksPorPonto: number;
  valorPonto: number;
  stopPontos: number;
  stopValor: number;
};

/** A conta do quadro de exemplo: quantos ticks cabem num ponto e quanto vale um stop de `stopPontos` com 1 contrato. */
export function exemploDeTick(
  tamanhoTick: number | null,
  valorTick: number | null,
  stopPontos = 10,
): ExemploTick | null {
  const valorPonto = valorPorPonto(tamanhoTick, valorTick);
  if (valorPonto === null || !positivo(tamanhoTick)) return null;
  return {
    ticksPorPonto: arredondar(1 / tamanhoTick),
    valorPonto: arredondar(valorPonto),
    stopPontos,
    stopValor: arredondar(stopPontos * valorPonto),
  };
}

const UNIDADES_VALIDAS: readonly string[] = UNIDADES;

/** Mensagem de erro para a especificação digitada, ou null quando está válida. */
export function validarEspecificacao(
  tamanhoTick: number | null,
  valorTick: number | null,
  unidade: string,
): string | null {
  if (!positivo(tamanhoTick)) return "Informe o tamanho do tick (maior que zero).";
  if (!positivo(valorTick)) return "Informe o valor do tick (maior que zero).";
  if (!UNIDADES_VALIDAS.includes(unidade)) return "Escolha a unidade do stop.";
  return null;
}

/** "mes" e "MES" são o mesmo ativo: maiúsculas, 1 a 10 letras ou números. */
export function normalizarCodigoAtivo(texto: string): string | null {
  const codigo = texto.trim().toUpperCase();
  return /^[A-Z0-9]{1,10}$/.test(codigo) ? codigo : null;
}

/** Espaços das pontas e repetidos saem; 1 a 40 caracteres. */
export function normalizarNomeCorretora(texto: string): string | null {
  const nome = texto.trim().replace(/\s+/g, " ");
  return nome.length >= 1 && nome.length <= 40 ? nome : null;
}
