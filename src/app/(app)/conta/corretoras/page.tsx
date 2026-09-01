import Link from "next/link";

import { listarCorretoras } from "@/lib/dados/corretoras";

import { TabelaCorretoras } from "./tabela";

export const metadata = { title: "Corretoras — AION" };

export default async function PaginaCorretoras() {
  const corretoras = await listarCorretoras();

  return (
    <>
      <header className="mb-5">
        <p className="mb-1.5 text-[14px] text-ink-3">
          <Link href="/conta">Conta</Link>
        </p>
        <h1 className="display text-[30px] leading-[1.05]">Corretoras</h1>
        <p className="mt-2 max-w-[560px] text-[14px] text-ink-3">
          Valor por ponto e unidade de cada ativo, por corretora. Editar aqui
          vale para toda conta marcada com essa corretora.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {corretoras.map((c) => (
          <section key={c.corretora} className="rounded-xl border border-line bg-card p-[22px]">
            <h2 className="display mb-4 text-[19px]">{c.corretora}</h2>
            <TabelaCorretoras corretora={c.corretora} ativos={c.ativos} />
          </section>
        ))}
      </div>
    </>
  );
}
