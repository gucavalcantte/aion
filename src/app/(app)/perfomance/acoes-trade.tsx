"use client";

import { useRef, useState } from "react";

import { BotaoRemover } from "@/components/botao-remover";
import type { Ativo, Moeda } from "@/lib/ativos";
import type { EspecificacaoAtivo } from "@/lib/dados/corretoras";
import { data as fData, moeda } from "@/lib/formato";

import { removerTrade } from "./acoes";
import { FormularioTrade } from "./formulario-trade";
import type { TradeParaEdicao } from "./formulario-trade";

export function AcoesDoTrade({
  trade,
  contaId,
  setups,
  moedaConta,
  especificacoes,
}: {
  trade: TradeParaEdicao;
  contaId: string;
  setups: { id: string; nome: string }[];
  moedaConta: Moeda;
  especificacoes: Partial<Record<Ativo, EspecificacaoAtivo>>;
}) {
  const [editando, setEditando] = useState(false);
  const visualizador = useRef<HTMLDialogElement>(null);

  return (
    <div className="flex items-center justify-end gap-3">
      {trade.imagem && (
        <>
          <button
            type="button"
            onClick={() => visualizador.current?.showModal()}
            aria-label={`Ver print do trade de ${fData(trade.data)}`}
            className="text-ink-4 hover:text-accent-soft"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
              <circle cx="8" cy="8" r="2.1" />
            </svg>
          </button>

          <dialog
            ref={visualizador}
            className="m-auto w-[min(90vw,860px)] whitespace-normal rounded-xl border border-line bg-card p-0 text-left backdrop:bg-black/80"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <p className="text-[14.5px] font-medium text-ink-2">
                Print de {fData(trade.data)} · {trade.ativo}
              </p>
              <button
                type="button"
                onClick={() => visualizador.current?.close()}
                aria-label="Fechar"
                className="text-ink-3 hover:text-ink"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-well p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={trade.imagem} alt="" className="mx-auto max-w-full rounded-md" />
            </div>
          </dialog>
        </>
      )}

      <button
        type="button"
        onClick={() => setEditando(true)}
        aria-label={`Editar trade de ${fData(trade.data)}`}
        className="text-ink-4 hover:text-accent-soft"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11.3 2.7a1.6 1.6 0 0 1 2.3 2.3L5.5 13 2 14l1-3.5z" />
        </svg>
      </button>

      <BotaoRemover
        acao={removerTrade}
        campos={{ id: trade.id }}
        rotulo={`Remover trade de ${fData(trade.data)}`}
        titulo="Remover este trade?"
        descricao={`${trade.ativo} · ${fData(trade.data)} · ${moeda(trade.resultado, moedaConta, true)}. O saldo da conta e todas as estatísticas mudam junto.`}
      />

      {editando && (
        <FormularioTrade
          contaId={contaId}
          setups={setups}
          trade={trade}
          moedaConta={moedaConta}
          especificacoes={especificacoes}
          aoFechar={() => setEditando(false)}
        />
      )}
    </div>
  );
}
