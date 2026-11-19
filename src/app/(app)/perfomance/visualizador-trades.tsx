"use client";

import { useEffect, useState } from "react";

import type { Moeda } from "@/lib/ativos";
import { data as fData, hora, moeda, VAZIO } from "@/lib/formato";
import { rotuloRiscoRetorno } from "@/lib/opcoes";

/** Um trade que tem print — já com tudo que o visualizador mostra ao lado. */
export type TradeComPrint = {
  id: string;
  url: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  ativo: string;
  tempo_grafico: string;
  setup: string;
  entrada: string | null;
  resultado: number;
  risco_retorno: number | null;
  status: "Gain" | "Loss" | "Zerado";
  respeitou_plano: boolean;
  observacao: string | null;
};

type FiltroStatus = "Todos" | "Gain" | "Loss" | "Zerado";
const FILTROS: FiltroStatus[] = ["Todos", "Gain", "Loss", "Zerado"];

export function VisualizadorTrades({ trades, moedaConta }: { trades: TradeComPrint[]; moedaConta: Moeda }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={trades.length === 0}
        title={trades.length === 0 ? "Nenhum trade desta conta tem print" : undefined}
        className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-line-strong bg-raised px-3.5 text-[14px] font-medium text-ink-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-ink-2"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.6" />
          <circle cx="5.6" cy="6.4" r="1.2" />
          <path d="M2 11.6l3.6-3.4 2.8 2.6 2.2-2 3.4 3" />
        </svg>
        Visualizar meus trades
      </button>

      {aberto && <Painel trades={trades} moedaConta={moedaConta} aoFechar={() => setAberto(false)} />}
    </>
  );
}

function Painel({
  trades,
  moedaConta,
  aoFechar,
}: {
  trades: TradeComPrint[];
  moedaConta: Moeda;
  aoFechar: () => void;
}) {
  const [filtro, setFiltro] = useState<FiltroStatus>("Todos");
  const [comparando, setComparando] = useState(false);
  const [indices, setIndices] = useState<[number, number]>([0, 1]);
  const [lado, setLado] = useState<0 | 1>(0);

  const lista = filtro === "Todos" ? trades : trades.filter((t) => t.status === filtro);
  const total = lista.length;
  const idx = (lado: 0 | 1) => Math.min(indices[lado], Math.max(0, total - 1));

  function mover(alvo: 0 | 1, passo: number) {
    if (total === 0) return;
    setIndices((atual) => {
      const novo: [number, number] = [atual[0], atual[1]];
      novo[alvo] = Math.min(Math.max(0, Math.min(atual[alvo], total - 1) + passo), total - 1);
      return novo;
    });
  }

  function trocarFiltro(f: FiltroStatus) {
    setFiltro(f);
    setIndices([0, 1]);
  }

  // Teclado: ←/→ andam no lado ativo, Esc fecha. O listener é refeito a cada
  // render porque `mover` lê o filtro e o total atuais.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
      else if (e.key === "ArrowLeft") { e.preventDefault(); mover(lado, -1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); mover(lado, 1); }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  });

  // Trava a rolagem da página por trás enquanto o painel está aberto.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
  }, []);

  const lados: (0 | 1)[] = comparando ? [0, 1] : [0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visualizar meus trades"
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
    >
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/10 px-6 py-3.5">
        <h2 className="display text-[18px] text-white">Meus trades</h2>

        <div className="flex gap-1.5" role="group" aria-label="Filtrar por resultado">
          {FILTROS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => trocarFiltro(f)}
              aria-pressed={filtro === f}
              className={`h-[30px] rounded-md px-3 text-[13px] font-medium ${filtro === f ? "bg-accent text-white" : "bg-white/10 text-white/70 hover:text-white"}`}
            >
              {f}
            </button>
          ))}
        </div>

        <span className="num text-[13px] text-white/50">
          {total === 0 ? "nenhum print" : `${total} ${total === 1 ? "print" : "prints"}`}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setComparando((c) => !c); setLado(0); }}
            aria-pressed={comparando}
            className={`h-[30px] rounded-md px-3 text-[13px] font-medium ${comparando ? "bg-accent text-white" : "bg-white/10 text-white/70 hover:text-white"}`}
          >
            Comparar
          </button>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="text-white/70 hover:text-white">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
      </header>

      {total === 0 ? (
        <p className="m-auto text-[14px] text-white/60">Nenhum trade {filtro === "Todos" ? "" : `${filtro} `}com print.</p>
      ) : (
        <div className={`grid min-h-0 flex-1 gap-3 p-4 ${comparando ? "grid-cols-2" : "grid-cols-1"}`}>
          {lados.map((l) => (
            <Quadro
              key={l}
              trade={lista[idx(l)]}
              posicao={idx(l)}
              total={total}
              moedaConta={moedaConta}
              ativo={comparando && lado === l}
              comparando={comparando}
              detalhado={!comparando}
              aoAtivar={() => setLado(l)}
              aoMover={(passo) => { setLado(l); mover(l, passo); }}
            />
          ))}
        </div>
      )}

      <p className="px-6 pb-3 text-center text-[12.5px] text-white/40">
        ← → navegam{comparando ? " no lado destacado (clique em um lado para escolher)" : ""} · Esc fecha
      </p>
    </div>
  );
}

function Quadro({
  trade,
  posicao,
  total,
  moedaConta,
  ativo,
  comparando,
  detalhado,
  aoAtivar,
  aoMover,
}: {
  trade: TradeComPrint;
  posicao: number;
  total: number;
  moedaConta: Moeda;
  ativo: boolean;
  comparando: boolean;
  /** Painel lateral completo (modo normal); na comparação vira uma linha só. */
  detalhado: boolean;
  aoAtivar: () => void;
  aoMover: (passo: number) => void;
}) {
  const [falhou, setFalhou] = useState<string | null>(null);
  const cor = trade.resultado > 0 ? "text-gain" : trade.resultado < 0 ? "text-loss" : "text-ink-3";

  return (
    <section
      onClick={aoAtivar}
      className={`flex min-h-0 min-w-0 flex-col rounded-xl border bg-card/60 ${ativo ? "border-accent" : "border-white/10"}`}
    >
      <div className={`flex min-h-0 flex-1 ${detalhado ? "flex-row" : "flex-col"}`}>
        <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center p-3">
          <SetaLateral lado="esquerda" desabilitada={posicao === 0} aoClicar={() => aoMover(-1)} />

          {falhou === trade.url ? (
            <p className="max-w-[320px] text-center text-[13.5px] text-white/60">
              Não consegui carregar este print — o link pode ter expirado.{" "}
              <a href={`/perfomance/print/${trade.id}`} target="_blank" rel="noopener noreferrer" className="text-accent-soft underline">
                Abrir em nova aba
              </a>
            </p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={trade.id}
              src={trade.url}
              alt={`Print do trade de ${fData(trade.data)} — ${trade.ativo}`}
              onError={() => setFalhou(trade.url)}
              className="max-h-full max-w-full rounded-md object-contain"
            />
          )}

          <SetaLateral lado="direita" desabilitada={posicao === total - 1} aoClicar={() => aoMover(1)} />
        </div>

        {detalhado && (
          <aside className="w-[290px] shrink-0 overflow-y-auto border-l border-white/10 p-5">
            <Detalhes trade={trade} moedaConta={moedaConta} cor={cor} />
          </aside>
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-white/10 px-4 py-2.5 text-[13.5px] text-white/80">
        <span className="num text-white/50">{posicao + 1} / {total}</span>
        <span className="num font-semibold">{trade.ativo} · {trade.tempo_grafico}</span>
        <span className="num text-white/60">{fData(trade.data)}</span>
        {comparando && (
          <span className={`num font-semibold ${cor}`}>{moeda(trade.resultado, moedaConta, true)}</span>
        )}
        <span className={`inline-flex h-[21px] items-center rounded-md px-2 text-[12px] font-semibold ${trade.status === "Gain" ? "bg-gain-bg text-gain" : trade.status === "Loss" ? "bg-loss-bg text-loss" : "bg-track text-ink-3"}`}>
          {trade.status}
        </span>
        <a
          href={`/perfomance/print/${trade.id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="ml-auto inline-flex items-center gap-1.5 text-accent-soft hover:underline"
        >
          Abrir em nova aba
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 2h5v5M14 2L7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" />
          </svg>
        </a>
      </footer>
    </section>
  );
}

function SetaLateral({
  lado,
  desabilitada,
  aoClicar,
}: {
  lado: "esquerda" | "direita";
  desabilitada: boolean;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); aoClicar(); }}
      disabled={desabilitada}
      aria-label={lado === "esquerda" ? "Trade mais recente" : "Trade mais antigo"}
      className={`absolute top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-25 disabled:hover:bg-black/60 ${lado === "esquerda" ? "left-3" : "right-3"}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={lado === "esquerda" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"} />
      </svg>
    </button>
  );
}

function Detalhes({ trade, moedaConta, cor }: { trade: TradeComPrint; moedaConta: Moeda; cor: string }) {
  const linha = (rotulo: string, valor: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/10 py-2 text-[13.5px]">
      <dt className="text-white/50">{rotulo}</dt>
      <dd className="num text-right text-white/90">{valor}</dd>
    </div>
  );

  return (
    <>
      <p className={`num text-[28px] font-semibold leading-none ${cor}`}>{moeda(trade.resultado, moedaConta, true)}</p>
      <dl className="mt-4">
        {linha("Data", fData(trade.data))}
        {linha("Horário", `${hora(trade.hora_inicio)} – ${hora(trade.hora_fim)}`)}
        {linha("Setup", trade.setup)}
        {linha("Entrada", trade.entrada ?? VAZIO)}
        {linha("R:R", rotuloRiscoRetorno(trade.risco_retorno))}
        {linha("Seguiu o plano", trade.respeitou_plano ? "Sim" : "Não")}
      </dl>
      {trade.observacao && (
        <p className="mt-4 whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/70">{trade.observacao}</p>
      )}
    </>
  );
}
