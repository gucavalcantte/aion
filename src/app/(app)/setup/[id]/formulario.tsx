"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import { salvarSetup, type EstadoSetup } from "../acoes";

const INICIAL: EstadoSetup = {};

const rotulo = "mb-[9px] block text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3";
const entrada =
  "h-[44px] w-full rounded-[9px] border border-line-strong bg-input px-[14px] text-[15px] text-ink outline-none placeholder:text-ink-4 focus:border-accent";
const area =
  "w-full resize-y rounded-[9px] border border-line-strong bg-input px-[14px] py-3 text-[14px] leading-[1.6] text-ink-2 outline-none placeholder:text-ink-4 focus:border-accent";

export type SetupEmEdicao = {
  id: string;
  nome: string;
  descricao: string | null;
  imagem: string | null;
  plano_evento: string | null;
  plano_adicao: string | null;
  plano_localizacao: string | null;
  plano_stop: string | null;
  plano_realizacao: string | null;
  plano_gestao_stop: string | null;
} | null;

export function FormularioSetup({ setup }: { setup: SetupEmEdicao }) {
  const [estado, acao, enviando] = useActionState(salvarSetup, INICIAL);
  const [previa, setPrevia] = useState<string | null>(setup?.imagem ?? null);
  const [removida, setRemovida] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  function escolher(lista: FileList | null) {
    const arquivo = lista?.[0];
    if (!arquivo) return;
    setPrevia(URL.createObjectURL(arquivo));
    setRemovida(false);
  }

  return (
    <form action={acao}>
      <input type="hidden" name="id" defaultValue={setup?.id ?? ""} />
      <input type="hidden" name="remover_imagem" value={removida ? "1" : "0"} />

      <header className="mb-5 flex items-end justify-between">
        <div>
          <p className="mb-[7px] flex items-center gap-2 text-[14px] text-ink-3">
            <Link href="/setup">Setups</Link>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 3l5 5-5 5" />
            </svg>
            <span className="font-semibold text-ink">{setup?.nome ?? "Novo"}</span>
          </p>
          <h1 className="display text-[30px] leading-[1.05]">
            {setup ? "Editar setup" : "Novo setup"}
          </h1>
        </div>
        <div className="flex gap-[9px]">
          <Link
            href="/setup"
            className="flex h-10 items-center rounded-[9px] border border-line-strong bg-raised px-[17px] text-[14.5px] font-medium text-ink-2"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={enviando}
            className="flex h-10 items-center gap-2 rounded-[9px] bg-accent px-[17px] text-[14.5px] font-semibold text-accent-ink disabled:opacity-60"
          >
            {enviando ? "Salvando…" : "Salvar setup"}
          </button>
        </div>
      </header>

      {estado.erro && (
        <p role="alert" className="mb-4 rounded-[10px] border border-loss/40 bg-loss-bg px-4 py-3 text-[14px] text-loss">
          {estado.erro}
        </p>
      )}

      <div className="grid grid-cols-[392px_minmax(0,1fr)] items-start gap-4">
        <section className="flex flex-col gap-[18px] rounded-xl border border-line bg-card p-[22px]">
          <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3">
            Identificação
          </h2>

          <div>
            <label className={rotulo} htmlFor="nome">Nome curto</label>
            <input id="nome" name="nome" defaultValue={setup?.nome ?? ""} placeholder="VBS / VSS" className={entrada} />
            <p className="mt-2 text-[12.5px] text-ink-4">
              Aparece nos dropdowns, nas tabelas e no plano impresso.
            </p>
          </div>

          <div>
            <label className={rotulo} htmlFor="descricao">Descrição</label>
            <textarea id="descricao" name="descricao" rows={4} defaultValue={setup?.descricao ?? ""} className={area} />
          </div>

          <div>
            <span className={rotulo}>Imagem de referência</span>
            <div className="rounded-[11px] border border-dashed border-line-strong bg-well p-[11px]">
              <button
                type="button"
                onClick={() => arquivoRef.current?.click()}
                className="flex h-[148px] w-full items-center justify-center overflow-hidden rounded-lg bg-input"
              >
                {previa && !removida ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previa} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-[13.5px] text-ink-4">clique para escolher uma imagem</span>
                )}
              </button>
              <input
                ref={arquivoRef}
                type="file"
                name="imagem"
                accept="image/*"
                onChange={(e) => escolher(e.target.files)}
                className="sr-only"
              />
              {previa && !removida && (
                <div className="mt-[11px] flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setRemovida(true); setPrevia(null); if (arquivoRef.current) arquivoRef.current.value = ""; }}
                    className="text-[13.5px] text-loss"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-card p-[22px] px-6">
          <div className="mb-5 border-b border-line pb-4">
            <h2 className="display text-[19px]">Plano de execução</h2>
            <p className="mt-1.5 text-[13px] text-ink-4">
              Estes seis campos formam a linha deste setup no Plano e na folha impressa.
              Campo vazio simplesmente não aparece.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-[22px] gap-y-[18px]">
            <Campo nome="plano_evento" titulo="Evento / gatilho" valor={setup?.plano_evento} />
            <Campo nome="plano_adicao" titulo="Adição" valor={setup?.plano_adicao} />
            <Campo nome="plano_localizacao" titulo="Localização" valor={setup?.plano_localizacao} />
            <Campo nome="plano_stop" titulo="Stop inicial" valor={setup?.plano_stop} />
            <Campo nome="plano_realizacao" titulo="Realização de lucros" valor={setup?.plano_realizacao} />
            <Campo nome="plano_gestao_stop" titulo="Gestão de stop" valor={setup?.plano_gestao_stop} />
          </div>
        </section>
      </div>
    </form>
  );
}

function Campo({
  nome,
  titulo,
  valor,
}: {
  nome: string;
  titulo: string;
  valor: string | null | undefined;
}) {
  return (
    <div>
      <label className={rotulo} htmlFor={nome}>{titulo}</label>
      <textarea id={nome} name={nome} rows={5} defaultValue={valor ?? ""} className={area} />
    </div>
  );
}
