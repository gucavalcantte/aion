"use client";

import { useActionState, useEffect, useRef } from "react";

import type { Moeda } from "@/lib/ativos";

import { salvarLancamento, type EstadoLancamento } from "./acoes";

const INICIAL: EstadoLancamento = {};

const rotulo = "mb-[9px] block text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3";
const campo =
  "h-[42px] w-full rounded-[9px] border border-line-strong bg-input px-[13px] text-[15px] text-ink outline-none placeholder:text-ink-4 focus:border-accent";

export function FormularioLancamento({ contaId, moedaConta }: { contaId: string; moedaConta: Moeda }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, acao, enviando] = useActionState(salvarLancamento, INICIAL);

  useEffect(() => {
    if (estado.ok) dialogo.current?.close();
  }, [estado]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className="flex h-[38px] items-center gap-2 rounded-lg border border-line-strong bg-raised px-[15px] text-[14.5px] font-medium text-ink-2"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h9A1.5 1.5 0 0 1 14 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5z" />
          <path d="M2 6.8h12" />
        </svg>
        Saque ou aporte
      </button>

      <dialog
        ref={dialogo}
        className="m-auto w-[420px] max-w-[calc(100vw-32px)] rounded-xl border border-line-strong bg-card p-0 text-ink backdrop:bg-black/70"
      >
        <form action={acao} autoComplete="off">
          <input type="hidden" name="conta_id" value={contaId} />

          <div className="p-[26px]">
            <h2 className="display mb-1.5 text-[19px]">Saque ou aporte</h2>
            <p className="mb-5 text-[13.5px] leading-[1.6] text-ink-4">
              Entra no saldo e sai de tudo o mais. Drawdown, MLPD e estatística seguem
              olhando só os trades — sacar não é perder.
            </p>

            <fieldset className="mb-[17px]">
              <legend className={rotulo}>Tipo</legend>
              <div className="flex gap-1 rounded-[9px] border border-line-strong bg-input p-[3px]">
                {(["Saque", "Aporte"] as const).map((t) => (
                  <label key={t} className="flex-1">
                    <input type="radio" name="tipo" value={t} defaultChecked={t === "Saque"} className="peer sr-only" />
                    <span className="block cursor-pointer rounded-md py-[7px] text-center text-[14.5px] font-medium text-ink-3 peer-checked:bg-raised peer-checked:text-ink">
                      {t}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mb-[17px] grid grid-cols-2 gap-3">
              <label>
                <span className={rotulo}>Data</span>
                <input name="data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={`${campo} num`} />
              </label>
              <label>
                <span className={rotulo}>Valor ({moedaConta})</span>
                <input name="valor" inputMode="decimal" placeholder="5000,00" className={`${campo} num`} />
              </label>
            </div>

            <label className="block">
              <span className={rotulo}>Observação</span>
              <input name="observacao" placeholder="opcional" className={campo} />
            </label>

            {estado.erro && (
              <p role="alert" className="mt-4 rounded-[9px] border border-loss/40 bg-loss-bg px-3 py-2.5 text-[13.5px] text-loss">
                {estado.erro}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2.5">
              <button type="button" onClick={() => dialogo.current?.close()} className="h-10 rounded-[9px] border border-line-strong bg-raised px-[17px] text-[14.5px] font-medium text-ink-2">
                Cancelar
              </button>
              <button type="submit" disabled={enviando} className="h-10 rounded-[9px] bg-accent px-[17px] text-[14.5px] font-semibold text-accent-ink disabled:opacity-60">
                {enviando ? "Registrando…" : "Registrar"}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
