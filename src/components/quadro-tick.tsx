"use client";

import type { Moeda } from "@/lib/ativos";
import { exemploDeTick, lerNumero } from "@/lib/contrato";
import { simboloDaMoeda, VAZIO } from "@/lib/formato";

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 });
const dinheiro = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

const SINGULAR: Record<string, string> = { pontos: "ponto", "dólares": "dólar", "%": "%" };

/**
 * Mostra, enquanto o usuário digita, o que o tick significa em dinheiro:
 *   1 tick = 0,1 pontos = $1,00
 *   1 ponto = 10 ticks = $10,00
 *   Ex.: stop de 10 pontos × 1 contrato = $100,00
 * Recebe os textos como estão nos campos; valor vazio ou inválido vira "—".
 */
export function QuadroTick({
  tamanhoTick,
  valorTick,
  unidade,
  moeda,
}: {
  tamanhoTick: string;
  valorTick: string;
  unidade: string;
  moeda: Moeda;
}) {
  const tick = lerNumero(tamanhoTick);
  const valor = lerNumero(valorTick);
  const exemplo = exemploDeTick(tick, valor);
  const simbolo = simboloDaMoeda(moeda);
  const dinheiroDe = (v: number | undefined) => (v === undefined ? VAZIO : `${simbolo}${dinheiro.format(v)}`);

  const unidadeSingular = SINGULAR[unidade] ?? unidade;
  const ticks = exemplo?.ticksPorPonto;

  return (
    <div
      aria-live="polite"
      className="rounded-[9px] border border-line-soft bg-well px-[14px] py-3 text-[13.5px] leading-[1.7] text-ink-2"
    >
      <p>
        <span className="num">1</span> tick ={" "}
        <span className="num">{tick && tick > 0 && exemplo ? numero.format(tick) : VAZIO}</span> {unidade} ={" "}
        <span className="num font-semibold text-ink">{dinheiroDe(valor && exemplo ? valor : undefined)}</span>
      </p>
      <p>
        <span className="num">1</span> {unidadeSingular} ={" "}
        <span className="num">{ticks === undefined ? VAZIO : numero.format(ticks)}</span> {ticks === 1 ? "tick" : "ticks"} ={" "}
        <span className="num font-semibold text-ink">{dinheiroDe(exemplo?.valorPonto)}</span>
      </p>
      <p className="text-ink-3">
        Ex.: stop de <span className="num">{exemplo ? numero.format(exemplo.stopPontos) : 10}</span> {unidade} × 1 contrato ={" "}
        <span className="num font-semibold text-ink">{dinheiroDe(exemplo?.stopValor)}</span>
      </p>
    </div>
  );
}
