import Link from "next/link";

import { listarSetups } from "@/lib/dados/setups";

import { GradeDeSetups } from "./grade";

export const metadata = { title: "Setups — AION" };

export default async function PaginaSetup({ searchParams }: PageProps<"/setup">) {
  const { erro } = await searchParams;
  const setups = await listarSetups();

  return (
    <>
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="display text-[30px] leading-[1.05]">Setups</h1>
          <p className="mt-2 text-[14px] text-ink-3">
            {setups.length === 0
              ? "Nenhum setup ainda"
              : `${setups.length} ${setups.length === 1 ? "estratégia" : "estratégias"} · arraste o card para reordenar`}
          </p>
        </div>
        <Link
          href="/setup/novo"
          className="flex h-[38px] items-center gap-2 rounded-lg bg-accent px-[15px] text-[14.5px] font-semibold text-accent-ink"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
            <path d="M8 3v10M3 8h10" />
          </svg>
          Novo setup
        </Link>
      </header>

      {typeof erro === "string" && (
        <p role="alert" className="mb-4 rounded-[10px] border border-loss/40 bg-loss-bg px-4 py-3 text-[14px] text-loss">
          {erro}
        </p>
      )}

      {setups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-card/50 p-12 text-center">
          <p className="text-[15px] text-ink-2">Cadastre o primeiro setup.</p>
          <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-relaxed text-ink-4">
            Backteste e Perfomance dependem dele: é o setup que liga o que você estudou
            ao que você executou.
          </p>
        </div>
      ) : (
        <GradeDeSetups setups={setups} />
      )}
    </>
  );
}
