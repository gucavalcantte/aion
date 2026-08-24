"use client";

import { useState } from "react";

import { BotaoRemover } from "@/components/botao-remover";
import type { EstudoComImagem } from "@/lib/dados/estudos";
import { data as fData } from "@/lib/formato";

import { removerEstudo } from "./acoes";
import { FormularioEstudo } from "./formulario";

export function Galeria({ estudos }: { estudos: EstudoComImagem[] }) {
  const [ampliada, setAmpliada] = useState<EstudoComImagem | null>(null);
  const [editando, setEditando] = useState<EstudoComImagem | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3.5">
        {estudos.map((estudo) => (
          <article key={estudo.id} className="overflow-hidden rounded-xl border border-line bg-card">
            <div className="flex h-[196px] items-center justify-center border-b border-line-soft bg-input p-2">
              {estudo.imagem ? (
                <button
                  type="button"
                  onClick={() => setAmpliada(estudo)}
                  aria-label="Ampliar print"
                  className="group relative size-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={estudo.imagem} alt="" className="size-full rounded-md object-contain" />
                  <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="7.2" cy="7.2" r="4.6" /><path d="M10.6 10.6L14 14M7.2 5.4v3.6M5.4 7.2h3.6" />
                    </svg>
                  </span>
                </button>
              ) : (
                <span className="text-[13px] text-ink-4">sem imagem</span>
              )}
            </div>

            <div className="p-[17px]">
              <div className="mb-[11px] flex items-center justify-between">
                <div className="flex gap-[7px]">
                  <span className="num inline-flex h-[23px] items-center rounded-md bg-raised px-[9px] text-[12.5px] font-semibold text-ink-2">
                    {estudo.ativo}
                  </span>
                  <span className="num inline-flex h-[23px] items-center rounded-md bg-raised px-[9px] text-[12.5px] font-semibold text-ink-2">
                    {estudo.tempo_grafico}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditando(estudo)}
                    aria-label="Editar estudo"
                    className="text-ink-4 hover:text-accent-soft"
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11.3 2.7a1.6 1.6 0 0 1 2.3 2.3L5.5 13 2 14l1-3.5z" />
                    </svg>
                  </button>
                  <BotaoRemover
                    acao={removerEstudo}
                    campos={{ id: estudo.id }}
                    rotulo="Remover estudo"
                    titulo="Remover este estudo?"
                    descricao={`${estudo.ativo} · ${estudo.tempo_grafico} · ${fData(estudo.data)}. O print sai junto e não dá para desfazer.`}
                  />
                </div>
              </div>
              <p className="text-[14px] leading-[1.6] text-ink-2">
                {estudo.observacao || <span className="text-ink-4">sem observação</span>}
              </p>
            </div>
          </article>
        ))}
      </div>

      {editando && (
        <FormularioEstudo dia={editando.data} estudo={editando} aoFechar={() => setEditando(null)} />
      )}

      {ampliada?.imagem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Print ampliado"
          onClick={() => setAmpliada(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-8"
        >
          <p className="num text-[15px] text-white/80">
            {ampliada.ativo} · {ampliada.tempo_grafico} · {fData(ampliada.data)}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ampliada.imagem}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[78vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
          {ampliada.observacao && (
            <p className="max-w-[680px] text-center text-[14px] leading-relaxed text-white/70">
              {ampliada.observacao}
            </p>
          )}
          <p className="text-[13px] text-white/50">clique fora para fechar</p>
        </div>
      )}
    </>
  );
}
