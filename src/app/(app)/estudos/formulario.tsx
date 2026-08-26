"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { ATIVOS } from "@/lib/ativos";
import { TEMPOS_GRAFICOS } from "@/lib/opcoes";
import type { Estudo } from "@/lib/tipos";

import { salvarEstudo, type EstadoEstudo } from "./acoes";

const INICIAL: EstadoEstudo = {};

const rotulo = "mb-[10px] block text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3";
const campo =
  "h-[44px] w-full rounded-[9px] border border-line-strong bg-input px-[14px] text-[15px] text-ink outline-none focus:border-accent";
const opcao =
  "block cursor-pointer rounded-lg border border-line-strong bg-raised px-[14px] py-[9px] text-[14.5px] font-medium text-ink-3 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink";

export function FormularioEstudo({
  dia,
  estudo,
  aoFechar,
}: {
  /** Data que o botão "Novo estudo" já traz preenchida. */
  dia: string;
  estudo?: Estudo & { imagem: string | null };
  aoFechar?: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, acao, enviando] = useActionState(salvarEstudo, INICIAL);
  const [previa, setPrevia] = useState<string | null>(estudo?.imagem ?? null);
  const arquivo = useRef<HTMLInputElement>(null);
  const editando = Boolean(estudo);

  // Em edição o diálogo já abre; em cadastro espera o clique no botão.
  useEffect(() => {
    if (editando) dialogo.current?.showModal();
  }, [editando]);

  useEffect(() => {
    if (!estado.ok) return;
    dialogo.current?.close();
    setPrevia(null);
    if (arquivo.current) arquivo.current.value = "";
    aoFechar?.();
  }, [estado, aoFechar]);

  function fechar() {
    dialogo.current?.close();
    aoFechar?.();
  }

  return (
    <>
      {!editando && (
        <button
          type="button"
          onClick={() => dialogo.current?.showModal()}
          className="flex h-[38px] items-center gap-2 rounded-lg bg-accent px-[15px] text-[14.5px] font-semibold text-accent-ink"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
            <path d="M8 3v10M3 8h10" />
          </svg>
          Novo estudo
        </button>
      )}

      <dialog
        ref={dialogo}
        onClose={() => aoFechar?.()}
        className="m-auto w-[952px] max-w-[calc(100vw-40px)] rounded-[15px] border border-line-strong bg-card p-0 text-ink backdrop:bg-black/75"
      >
        <form action={acao} autoComplete="off">
          <input type="hidden" name="id" defaultValue={estudo?.id ?? ""} />

          <header className="flex items-center justify-between border-b border-line px-[26px] py-[22px]">
            <h2 className="display text-[21px]">{editando ? "Editar estudo" : "Novo estudo"}</h2>
            <button type="button" onClick={fechar} aria-label="Fechar" className="text-ink-3 hover:text-ink">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </header>

          <div className="grid grid-cols-[minmax(0,1fr)_344px] gap-[26px] px-[26px] py-6">
            <div>
              <span className={rotulo}>Print do gráfico</span>
              <div className="rounded-[12px] border border-dashed border-line-strong bg-well p-3">
                <button
                  type="button"
                  onClick={() => arquivo.current?.click()}
                  className="flex h-[294px] w-full items-center justify-center overflow-hidden rounded-[9px] bg-input p-2"
                >
                  {previa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previa} alt="" className="size-full rounded-md object-contain" />
                  ) : (
                    <span className="text-[13.5px] text-ink-4">clique para escolher o print</span>
                  )}
                </button>
                <input
                  ref={arquivo}
                  type="file"
                  name="imagem"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPrevia(URL.createObjectURL(f));
                  }}
                  className="sr-only"
                />
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <label>
                <span className={rotulo}>Data</span>
                <input name="data" type="date" defaultValue={estudo?.data ?? dia} className={`${campo} num`} />
              </label>

              <div>
                <span className={rotulo}>Ativo</span>
                <div className="flex flex-wrap gap-[7px]">
                  {ATIVOS.map((a) => (
                    <label key={a.codigo}>
                      <input type="radio" name="ativo" value={a.codigo} defaultChecked={(estudo?.ativo ?? "MNQ") === a.codigo} className="peer sr-only" />
                      <span className={`num ${opcao}`}>{a.codigo}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className={rotulo}>Tempo gráfico</span>
                <div className="flex flex-wrap gap-[7px]">
                  {TEMPOS_GRAFICOS.map((t) => (
                    <label key={t}>
                      <input type="radio" name="tempo_grafico" value={t} defaultChecked={(estudo?.tempo_grafico ?? "2m") === t} className="peer sr-only" />
                      <span className={`num ${opcao}`}>{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex flex-1 flex-col">
                <span className={rotulo}>Observação</span>
                <textarea
                  name="observacao"
                  rows={7}
                  defaultValue={estudo?.observacao ?? ""}
                  placeholder="a entrada que estava no plano e você não puxou o gatilho, o que segurou, o que faria diferente"
                  className="flex-1 resize-y rounded-[9px] border border-line-strong bg-input px-[14px] py-3 text-[14.5px] leading-[1.6] text-ink-2 outline-none placeholder:text-ink-4 focus:border-accent"
                />
              </label>
            </div>
          </div>

          {estado.erro && (
            <p role="alert" className="mx-[26px] mb-4 rounded-[10px] border border-loss/40 bg-loss-bg px-4 py-3 text-[14px] text-loss">
              {estado.erro}
            </p>
          )}

          <footer className="flex items-center justify-between border-t border-line bg-tint px-[26px] py-[18px]">
            <p className="text-[13.5px] text-ink-4">
              Estudo não entra em nenhuma estatística — é registro, não trade.
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={fechar} className="h-[42px] rounded-[9px] border border-line-strong bg-raised px-[19px] text-[15px] font-medium text-ink-2">
                Cancelar
              </button>
              <button type="submit" disabled={enviando} className="h-[42px] rounded-[9px] bg-accent px-[19px] text-[15px] font-semibold text-accent-ink disabled:opacity-60">
                {enviando ? "Salvando…" : "Salvar estudo"}
              </button>
            </div>
          </footer>
        </form>
      </dialog>
    </>
  );
}
