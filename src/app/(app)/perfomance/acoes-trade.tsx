"use client";

import { useState } from "react";

import { BotaoRemover } from "@/components/botao-remover";
import type { Moeda } from "@/lib/ativos";
import { data as fData, moeda } from "@/lib/formato";

import { removerTrade } from "./acoes";
import { FormularioTrade } from "./formulario-trade";
import type { TradeParaEdicao } from "./formulario-trade";

export function AcoesDoTrade({
  trade,
  contaId,
  setups,
  moedaConta,
}: {
  trade: TradeParaEdicao;
  contaId: string;
  setups: { id: string; nome: string }[];
  moedaConta: Moeda;
}) {
  const [editando, setEditando] = useState(false);

  return (
    <div className="flex items-center justify-end gap-3">
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
          aoFechar={() => setEditando(false)}
        />
      )}
    </div>
  );
}
