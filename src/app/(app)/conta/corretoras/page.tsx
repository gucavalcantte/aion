import Link from "next/link";

import { listarAtivos } from "@/lib/dados/ativos";
import { listarCorretorasDoUsuario } from "@/lib/dados/corretoras";

import { CabecalhoCorretora, FormularioNovaCorretora } from "./formulario-corretora";
import { TabelaCorretoras } from "./tabela";

export const metadata = { title: "Corretoras — AION" };

export default async function PaginaCorretoras({ searchParams }: PageProps<"/conta/corretoras">) {
  const { erro } = await searchParams;
  const [corretoras, ativos] = await Promise.all([listarCorretorasDoUsuario(), listarAtivos()]);

  return (
    <>
      <header className="mb-5">
        <p className="mb-1.5 text-[14px] text-ink-3">
          <Link href="/conta">Conta</Link>
        </p>
        <h1 className="display text-[30px] leading-[1.05]">Corretoras</h1>
        <p className="mt-2 max-w-[560px] text-[14px] text-ink-3">
          Cada corretora tem os ativos que cobre e o valor de cada um nela. Editar aqui vale para toda
          conta marcada com essa corretora; trades já registrados não mudam.
        </p>
      </header>

      {typeof erro === "string" && (
        <p role="alert" className="mb-4 rounded-[10px] border border-loss/40 bg-loss-bg px-4 py-3 text-[14px] text-loss">
          {erro}
        </p>
      )}

      <div className="flex items-start gap-5 med:flex-col med:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {corretoras.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong bg-card/50 p-10 text-center">
              <p className="text-[15px] text-ink-2">Cadastre a primeira corretora ao lado.</p>
              <p className="mt-2 text-[13.5px] text-ink-4">
                Toda conta pertence a uma corretora — ela precisa existir antes.
              </p>
            </div>
          ) : (
            corretoras.map((c) => (
              <section key={c.id} className="rounded-xl border border-line bg-card p-[22px]">
                <CabecalhoCorretora corretora={c} />
                <TabelaCorretoras corretora={c} todosOsAtivos={ativos} />
              </section>
            ))
          )}
        </div>

        <FormularioNovaCorretora ativos={ativos} />
      </div>
    </>
  );
}
