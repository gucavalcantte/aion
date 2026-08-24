"use client";

import { useActionState, useState } from "react";

import { entrar, type EstadoLogin } from "./acoes";

const INICIAL: EstadoLogin = {};

export function FormularioLogin() {
  const [estado, acao, enviando] = useActionState(entrar, INICIAL);
  const [verSenha, setVerSenha] = useState(false);

  return (
    <form
      action={acao}
      className="rounded-[14px] border border-line bg-card p-8 pb-7 shadow-[0_28px_70px_rgba(0,0,0,0.35)]"
    >
      <label className="block">
        <span className="mb-[10px] block text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3">
          E-mail
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="voce@email.com"
          className="h-12 w-full rounded-[10px] border border-line-strong bg-input px-4 text-[15.5px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
        />
      </label>

      <label className="mt-[22px] block">
        <span className="mb-[10px] block text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3">
          Senha
        </span>
        <span className="relative block">
          <input
            name="senha"
            type={verSenha ? "text" : "password"}
            autoComplete="current-password"
            className="num h-12 w-full rounded-[10px] border border-line-strong bg-input px-4 pr-12 text-[16px] tracking-[0.14em] text-ink outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setVerSenha((v) => !v)}
            aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-3 hover:text-ink-2"
          >
            <svg width="19" height="19" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1.3 8S3.7 3.6 8 3.6 14.7 8 14.7 8 12.3 12.4 8 12.4 1.3 8 1.3 8z" />
              <circle cx="8" cy="8" r="2.1" />
              {!verSenha && <path d="M3 13L13 3" />}
            </svg>
          </button>
        </span>
      </label>

      <div className="mt-5 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-[10px] text-[14.5px] text-ink-2">
          <input
            type="checkbox"
            name="manter"
            defaultChecked
            className="size-[19px] appearance-none rounded-[5px] border border-line-strong bg-input checked:border-accent checked:bg-accent checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222.6%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M3 8.4l3.2 3.2L13 4.8%22/></svg>')] checked:bg-center checked:bg-no-repeat"
          />
          Manter conectado
        </label>
      </div>

      {estado.erro && (
        <p
          role="alert"
          className="mt-5 rounded-[10px] border border-loss/40 bg-loss-bg px-4 py-3 text-[14px] text-loss"
        >
          {estado.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-6 flex h-[50px] w-full items-center justify-center gap-[10px] rounded-[10px] bg-accent text-[16px] font-bold text-accent-ink transition-opacity disabled:opacity-60"
      >
        {enviando ? "Entrando…" : "Entrar"}
        {!enviando && (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h9" />
            <path d="M8.5 4.5L12 8l-3.5 3.5" />
          </svg>
        )}
      </button>
    </form>
  );
}
