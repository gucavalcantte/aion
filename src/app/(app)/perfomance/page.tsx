import { Marca } from "@/components/marca";
import { usuarioAtual } from "@/lib/supabase/servidor";

import { sair } from "../../login/acoes";

export const metadata = { title: "Perfomance — AION" };

/**
 * Provisória. Existe para fechar a Fase 0 provando que login, sessão e logout
 * funcionam de ponta a ponta. A tela real vem na Fase 5.
 */
export default async function Perfomance() {
  const usuario = await usuarioAtual();

  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col justify-center gap-6 px-8">
      <Marca tamanho={26} corpo={22} />

      <div className="rounded-xl border border-line bg-card p-7">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3">
          Sessão ativa
        </p>
        <p className="num mt-3 text-[19px] font-semibold">{usuario?.email}</p>
        <p className="mt-2 text-[14px] text-ink-3">
          Autenticação funcionando. As telas entram a partir da Fase 2.
        </p>

        <form action={sair} className="mt-6">
          <button
            type="submit"
            className="flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-raised px-4 text-[14.5px] font-medium text-ink-2"
          >
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6.4 13.6H3.9a1.5 1.5 0 0 1-1.5-1.5V3.9a1.5 1.5 0 0 1 1.5-1.5h2.5" />
              <path d="M10.6 11.2L13.8 8l-3.2-3.2" />
              <path d="M13.8 8H6.2" />
            </svg>
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
