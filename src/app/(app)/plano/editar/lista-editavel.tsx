"use client";

import { useState } from "react";

let contador = 0;
const novaChave = () => `l${contador++}`;

/**
 * Lista de linhas de texto que vira um array no banco. Cada linha é um input
 * de mesmo nome — o FormData junta com getAll, sem JSON no meio.
 */
export function ListaEditavel({
  nome,
  inicial,
  rotuloAdicionar,
  placeholder,
}: {
  nome: string;
  inicial: string[];
  rotuloAdicionar: string;
  placeholder?: string;
}) {
  const [itens, setItens] = useState(() =>
    (inicial.length > 0 ? inicial : [""]).map((texto) => ({ chave: novaChave(), texto })),
  );

  const trocar = (chave: string, texto: string) =>
    setItens((atual) => atual.map((i) => (i.chave === chave ? { ...i, texto } : i)));

  const remover = (chave: string) =>
    setItens((atual) => (atual.length === 1 ? [{ chave: novaChave(), texto: "" }] : atual.filter((i) => i.chave !== chave)));

  const mover = (de: number, para: number) =>
    setItens((atual) => {
      if (para < 0 || para >= atual.length) return atual;
      const novo = [...atual];
      const [item] = novo.splice(de, 1);
      novo.splice(para, 0, item);
      return novo;
    });

  return (
    <div className="flex flex-col gap-2">
      {itens.map((item, indice) => (
        <div key={item.chave} className="flex items-center gap-2.5">
          <span className="flex flex-col text-ink-4">
            <button
              type="button"
              onClick={() => mover(indice, indice - 1)}
              disabled={indice === 0}
              aria-label="Mover para cima"
              className="disabled:opacity-25 hover:text-ink-2"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10l4-4 4 4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => mover(indice, indice + 1)}
              disabled={indice === itens.length - 1}
              aria-label="Mover para baixo"
              className="disabled:opacity-25 hover:text-ink-2"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
          </span>

          <input
            name={nome}
            value={item.texto}
            onChange={(e) => trocar(item.chave, e.target.value)}
            placeholder={placeholder}
            className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-input px-3 text-[14px] text-ink-2 outline-none placeholder:text-ink-4 focus:border-accent"
          />

          <button
            type="button"
            onClick={() => remover(item.chave)}
            aria-label="Remover linha"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-4 hover:text-loss"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setItens((atual) => [...atual, { chave: novaChave(), texto: "" }])}
        className="ml-[23px] flex h-10 items-center gap-2.5 self-start rounded-lg border border-dashed border-line-strong px-3.5 text-[14px] font-medium text-accent-soft"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M8 3v10M3 8h10" />
        </svg>
        {rotuloAdicionar}
      </button>
    </div>
  );
}
