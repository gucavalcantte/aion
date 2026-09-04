"use client";

import { useState } from "react";

import type { Ativo, Moeda } from "@/lib/ativos";
import type { EspecificacaoAtivo } from "@/lib/dados/corretoras";
import type { Trade } from "@/lib/dados/trades";
import { data as fData, hora, moeda, VAZIO } from "@/lib/formato";
import { rotuloRiscoRetorno } from "@/lib/opcoes";

import { AcoesDoTrade } from "./acoes-trade";

const TAMANHO_PAGINA = 20;

export function TabelaTrades({
  listagem,
  totalTrades,
  setups,
  contaId,
  moedaConta,
  especificacoes,
}: {
  listagem: Trade[];
  totalTrades: number;
  setups: { id: string; nome: string }[];
  contaId: string;
  moedaConta: Moeda;
  especificacoes: Partial<Record<Ativo, EspecificacaoAtivo>>;
}) {
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(listagem.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicioPagina = (paginaAtual - 1) * TAMANHO_PAGINA;
  const listagemPagina = listagem.slice(inicioPagina, inicioPagina + TAMANHO_PAGINA);
  const fimPagina = inicioPagina + listagemPagina.length;

  if (listagem.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-[14px] text-ink-4">
        {totalTrades === 0 ? "Nenhum trade ainda." : "Nenhum trade com esses filtros."}
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 1520 }}>
          <thead>
            <tr>
              {["Data", "Entrada", "Saída", "Ativo", "TG", "Setup", "Tipo entrada", "Contratos", "Stop pts", "Stop $", "Resultado", "Pontos", "R:R", "Plano", "Status", ""].map((t, i) => (
                <th
                  key={t + i}
                  scope="col"
                  className={`whitespace-nowrap border-b border-line-strong bg-table-head px-[13px] py-3 text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-2 ${[7, 8, 9, 10, 11, 12].includes(i) ? "text-right" : "text-left"}`}
                >
                  {[9, 11, 14].includes(i) ? <>{t} <Calc /></> : t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listagemPagina.map((t) => {
              const td = "whitespace-nowrap border-b border-line-soft bg-table-row px-[13px] py-[11px] text-[14.5px] text-ink-2 transition-colors group-hover:bg-raised";
              const setup = setups.find((s) => s.id === t.setup_id)?.nome ?? VAZIO;
              return (
                <tr key={t.id} className="group">
                  <td className={`${td} num`}>{fData(t.data)}</td>
                  <td className={`${td} num`}>{hora(t.hora_inicio)}</td>
                  <td className={`${td} num`}>{hora(t.hora_fim)}</td>
                  <td className={`${td} num font-semibold`}>{t.ativo}</td>
                  <td className={`${td} num`}>{t.tempo_grafico}</td>
                  <td className={td}>{setup}</td>
                  <td className={td}>{t.entrada ?? VAZIO}</td>
                  <td className={`${td} num text-right`}>{t.contratos}</td>
                  <td className={`${td} num text-right`}>{String(t.pontos_stop).replace(".", ",")}</td>
                  <td className={`${td} num text-right text-ink-3`}>{moeda(t.stop_dolar, moedaConta)}</td>
                  <td className={`${td} num text-right font-semibold ${t.resultado > 0 ? "!text-gain" : t.resultado < 0 ? "!text-loss" : "!text-ink-3"}`}>
                    {moeda(t.resultado, moedaConta, true)}
                  </td>
                  <td className={`${td} num text-right !text-ink-3`}>
                    {t.resultado_pontos === null ? VAZIO : t.resultado_pontos.toFixed(2).replace(".", ",")}
                  </td>
                  <td className={`${td} num text-right font-semibold ${(t.risco_retorno ?? 0) >= 0 ? "" : "!text-loss"}`}>
                    {rotuloRiscoRetorno(t.risco_retorno)}
                  </td>
                  <td className={td}>
                    <Selo ok={t.respeitou_plano}>{t.respeitou_plano ? "Sim" : "Não"}</Selo>
                  </td>
                  <td className={td}>
                    <span className={`inline-flex h-[23px] items-center rounded-md px-[9px] text-[13px] font-semibold ${t.status === "Gain" ? "bg-gain-bg text-gain" : t.status === "Loss" ? "bg-loss-bg text-loss" : "bg-track text-ink-3"}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className={td}>
                    <AcoesDoTrade
                      trade={{ ...t, imagem: null }}
                      contaId={contaId}
                      setups={setups}
                      moedaConta={moedaConta}
                      especificacoes={especificacoes}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
        <p className="flex items-center gap-2 text-[13px] text-ink-4">
          <Calc /> calculado pelo app — não se digita
        </p>

        {listagem.length > TAMANHO_PAGINA && (
          <div className="flex items-center gap-3">
            <span className="num text-[13px] text-ink-4">
              {inicioPagina + 1}–{fimPagina} de {listagem.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPagina(paginaAtual - 1)}
                disabled={paginaAtual === 1}
                aria-label="Página anterior"
                className="flex size-8 items-center justify-center rounded-lg border border-line-strong bg-raised text-ink-2 hover:text-ink disabled:opacity-40 disabled:hover:text-ink-2"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 3L5 8l5 5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setPagina(paginaAtual + 1)}
                disabled={paginaAtual === totalPaginas}
                aria-label="Próxima página"
                className="flex size-8 items-center justify-center rounded-lg border border-line-strong bg-raised text-ink-2 hover:text-ink disabled:opacity-40 disabled:hover:text-ink-2"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Calc() {
  return <span className="inline-block size-[5px] rounded-full bg-accent-soft align-super" aria-label="calculado" />;
}

function Selo({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-[23px] items-center rounded-md px-[9px] text-[13px] font-semibold ${ok ? "bg-gain-bg text-gain" : "bg-loss-bg text-loss"}`}>
      {children}
    </span>
  );
}
