"use client";

import { useRef } from "react";

/**
 * Um único botão de remover para o app inteiro. Usa <dialog> nativo, que já
 * traz Esc para fechar, foco preso dentro e leitura correta por leitor de tela.
 */
export function BotaoRemover({
  acao,
  campos,
  titulo,
  descricao,
  rotulo,
  aviso,
  variante = "icone",
}: {
  acao: (dados: FormData) => Promise<void>;
  campos: Record<string, string>;
  /** Título do diálogo. Ex.: "Remover conta 512-4471" */
  titulo: string;
  /** O que acontece ao confirmar. */
  descricao: string;
  /** Rótulo acessível do botão que abre. */
  rotulo: string;
  /** Linha extra, quando há algo que o usuário precisa saber antes. */
  aviso?: string;
  variante?: "icone" | "botao";
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  return (
    <form action={acao} className="flex">
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}

      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        aria-label={rotulo}
        className={
          variante === "botao"
            ? "flex h-10 items-center gap-2 rounded-[9px] border border-loss/50 px-[17px] text-[14.5px] font-medium text-loss"
            : "text-ink-4 hover:text-loss"
        }
      >
        <svg width={variante === "botao" ? 15 : 16} height={variante === "botao" ? 15 : 16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2.5 4h11M6 4V2.7h4V4M4 4l.7 9.3h6.6L12 4" />
        </svg>
        {variante === "botao" && "Remover"}
      </button>

      <dialog
        ref={dialogo}
        className="m-auto w-[420px] max-w-[calc(100vw-32px)] rounded-xl border border-line bg-card p-0 text-ink backdrop:bg-black/70"
      >
        <div className="p-[26px]">
          <div className="mb-4 flex items-start gap-[13px]">
            <span className="mt-0.5 shrink-0 text-loss">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 2.4l6 10.4H2z" />
                <path d="M8 6.4v2.8M8 11.2v.1" />
              </svg>
            </span>
            <div>
              <h2 className="display text-[19px] leading-tight">{titulo}</h2>
              <p className="mt-2.5 text-[14px] leading-[1.6] text-ink-2">{descricao}</p>
              {aviso && <p className="mt-2.5 text-[13.5px] leading-[1.6] text-ink-4">{aviso}</p>}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="h-10 rounded-[9px] border border-line-strong bg-raised px-[17px] text-[14.5px] font-medium text-ink-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-10 rounded-[9px] bg-loss px-[17px] text-[14.5px] font-semibold text-[#2A0A10]"
            >
              Remover
            </button>
          </div>
        </div>
      </dialog>
    </form>
  );
}
