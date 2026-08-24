import Link from "next/link";
import { notFound } from "next/navigation";

import { listarBacktestes, totalDoTempo } from "@/lib/dados/backtestes";
import { listarSetupsSimples } from "@/lib/dados/setups";
import { emR, inteiro, percentual } from "@/lib/formato";
import { ehTempoGrafico } from "@/lib/opcoes";

import { TabelaBackteste } from "./tabela";

export const metadata = { title: "Backteste — AION" };

export default async function PaginaTempo({
  params,
  searchParams,
}: PageProps<"/backteste/[tempo]">) {
  const { tempo: bruto } = await params;
  const tempo = decodeURIComponent(bruto);
  if (!ehTempoGrafico(tempo)) notFound();

  const { setup } = await searchParams;
  const filtro = typeof setup === "string" && setup !== "" ? setup : undefined;

  const [{ linhas, resumo }, setups, total] = await Promise.all([
    listarBacktestes(tempo, filtro),
    listarSetupsSimples(),
    totalDoTempo(tempo),
  ]);

  const nomeFiltro = setups.find((s) => s.id === filtro)?.nome;

  return (
    <>
      <header className="mb-5">
        <p className="mb-1.5 flex items-center gap-2 text-[14px] text-ink-3">
          <Link href="/backteste">Backteste</Link>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 3l5 5-5 5" />
          </svg>
          <span className="num font-semibold text-accent-soft">{tempo}</span>
        </p>
        <h1 className="display text-[30px] leading-[1.05]">
          Estudo no gráfico de {tempo}
        </h1>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Cartao titulo={filtro ? "Registros no filtro" : "Registros"} valor={inteiro(resumo.registros)} />
        <Cartao titulo="Assertividade" valor={percentual(resumo.assertividade)} />
        <Cartao
          titulo="Risco retorno"
          valor={emR(resumo.riscoRetorno)}
          cor={
            resumo.riscoRetorno === null
              ? "text-ink-4"
              : resumo.riscoRetorno >= 0
                ? "text-gain"
                : "text-loss"
          }
        />
      </div>

      {setups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-card/50 p-12 text-center">
          <p className="text-[15px] text-ink-2">Cadastre um setup antes de estudar.</p>
          <p className="mt-2 text-[13.5px] text-ink-4">
            Toda linha de backteste aponta para um setup — é isso que liga o estudo à execução.
          </p>
          <Link href="/setup/novo" className="mt-4 inline-block text-[14px]">
            Criar setup →
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-3">
            <FiltroSetup tempo={tempo} setups={setups} atual={filtro} />
            {filtro && (
              <p className="text-[14px] text-ink-4">
                <span className="num">{resumo.registros}</span> de{" "}
                <span className="num">{total}</span> registros
                {nomeFiltro ? ` · ${nomeFiltro}` : ""}
              </p>
            )}
          </div>

          <TabelaBackteste
            tempo={tempo}
            linhas={linhas}
            setups={setups}
          />
        </>
      )}
    </>
  );
}

function FiltroSetup({
  tempo,
  setups,
  atual,
}: {
  tempo: string;
  setups: { id: string; nome: string }[];
  atual?: string;
}) {
  return (
    <form className="flex items-center gap-2">
      <label htmlFor="filtro-setup" className="sr-only">Filtrar por setup</label>
      <select
        id="filtro-setup"
        name="setup"
        defaultValue={atual ?? ""}
        className={
          "h-[38px] rounded-lg border bg-raised px-[13px] text-[14.5px] outline-none " +
          (atual ? "border-accent text-accent-soft" : "border-line-strong text-ink-2")
        }
      >
        <option value="">Todos os setups</option>
        {setups.map((s) => (
          <option key={s.id} value={s.id}>{s.nome}</option>
        ))}
      </select>
      <button
        type="submit"
        formAction={`/backteste/${encodeURIComponent(tempo)}`}
        className="h-[38px] rounded-lg border border-line-strong bg-raised px-[14px] text-[14.5px] font-medium text-ink-2"
      >
        Filtrar
      </button>
    </form>
  );
}

function Cartao({ titulo, valor, cor = "" }: { titulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-[18px] py-[15px]">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3">{titulo}</p>
      <p className={`num mt-2 text-[26px] font-semibold tracking-[-0.03em] ${cor}`}>{valor}</p>
    </div>
  );
}
