import { Arco } from "@/components/marca";

import { FormularioLogin } from "./formulario";

export const metadata = { title: "Entrar — AION" };

export default function Login() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden">
      {/* a marca ampliada, quase invisível */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden
        className="pointer-events-none absolute -left-[260px] -top-[210px] size-[1240px] opacity-[0.075]"
      >
        <path d="M88 50a38 38 0 1 1-13.2-28.8" stroke="var(--accent-soft)" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M89.4 12v18h-18" stroke="var(--accent-soft)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden
        className="pointer-events-none absolute -bottom-[290px] -right-[250px] size-[880px] opacity-[0.07]"
      >
        <circle cx="50" cy="50" r="40" stroke="var(--accent)" strokeWidth="1.6" />
        <circle cx="50" cy="50" r="29" stroke="var(--accent)" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="18" stroke="var(--accent)" strokeWidth="0.9" />
      </svg>

      <div className="relative w-[436px] max-w-[calc(100vw-32px)]">
        <div className="mb-[34px] flex flex-col items-center">
          <Arco tamanho={52} />
          <h1
            className="display mt-[18px] text-[44px] leading-none"
            style={{ letterSpacing: "0.26em", paddingLeft: "0.26em" }}
          >
            AION
          </h1>
          <p className="display mt-4 text-[15px] uppercase tracking-[0.14em] text-ink-2">
            ciclos, tempo e consistência
          </p>
        </div>

        <FormularioLogin />

        <p className="mt-6 flex items-center justify-center gap-[9px] text-[13.5px] text-ink-3">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4.6 7V5a3.4 3.4 0 0 1 6.8 0v2" />
            <rect x="3.3" y="7" width="9.4" height="6.4" rx="1.5" />
          </svg>
          Acesso restrito — contas criadas pelo administrador
        </p>
      </div>
    </main>
  );
}
