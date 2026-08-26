import Link from "next/link";
import { notFound } from "next/navigation";

import { DIMENSOES, type Dimensao } from "@/lib/analise";
import { ATIVOS } from "@/lib/ativos";
import { listarBacktestes, totalDoTempo } from "@/lib/dados/backtestes";
import { mlptDaContaPadrao } from "@/lib/dados/contas";
import { listarSetupsSimples } from "@/lib/dados/setups";
import { emR, inteiro, percentual } from "@/lib/formato";
import { ehTempoGrafico } from "@/lib/opcoes";

import { Contextos } from "./contextos";
import { TabelaBackteste } from "./tabela";

export const metadata = { title: "Backteste — AION" };

export default async function PaginaTempo({
  params,
  searchParams,
}: PageProps<"/backteste/[tempo]">) {
  const { tempo: bruto } = await params;
  const tempo = decodeURIComponent(bruto);
  if (!ehTempoGrafico(tempo)) notFound();

  const { setup, ativo, dim } = await searchParams;

  // Os filtros valem para a tela inteira: cards do topo, tabela e análise.
  const filtros = {
    setup: typeof setup === "string" && setup !== "" ? setup : undefined,
    ativo: typeof ativo === "string" && ativo !== "" ? ativo : undefined,
  };
  const temFiltro = Boolean(filtros.setup || filtros.ativo);
  const dimensao = (DIMENSOES.find((d) => d.chave === dim)?.chave ?? "localizacao") as Dimensao;

  const [{ linhas, resumo }, setups, total, mlpt] = await Promise.all([
    listarBacktestes(tempo, filtros),
    listarSetupsSimples(),
    totalDoTempo(tempo),
    mlptDaContaPadrao(),
  ]);

  const nomeDoSetup = setups.find((s) => s.id === filtros.setup)?.nome;

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
        <Cartao
          titulo={temFiltro ? "Registros no filtro" : "Registros"}
          valor={inteiro(resumo.registros)}
        />
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
            <Filtros
              tempo={tempo}
              setups={setups}
              atual={filtros}
              dim={typeof dim === "string" ? dim : undefined}
            />
            {temFiltro && (
              <p className="text-[14px] text-ink-4">
                <span className="num">{resumo.registros}</span> de{" "}
                <span className="num">{total}</span> registros
                {[nomeDoSetup, filtros.ativo].filter(Boolean).map((r) => ` · ${r}`).join("")}
              </p>
            )}
          </div>

          <TabelaBackteste tempo={tempo} linhas={linhas} setups={setups} mlpt={mlpt} />

          <div id="contexto" className="mt-5 scroll-mt-6">
            <Contextos linhas={linhas} tempo={tempo} dimensao={dimensao} filtros={filtros} />
          </div>
        </>
      )}
    </>
  );
}

function Filtros({
  tempo,
  setups,
  atual,
  dim,
}: {
  tempo: string;
  setups: { id: string; nome: string }[];
  atual: { setup?: string; ativo?: string };
  dim?: string;
}) {
  const estilo = (aceso: boolean) =>
    "h-[38px] rounded-lg border bg-raised px-[13px] text-[14.5px] outline-none " +
    (aceso ? "border-accent text-accent-soft" : "border-line-strong text-ink-2");

  return (
    <form action={`/backteste/${encodeURIComponent(tempo)}`} className="flex items-center gap-2">
      {/* preserva a dimensão escolhida na análise ao trocar de filtro */}
      {dim && <input type="hidden" name="dim" value={dim} />}

      <label htmlFor="filtro-setup" className="sr-only">Filtrar por setup</label>
      <select
        id="filtro-setup"
        name="setup"
        defaultValue={atual.setup ?? ""}
        className={estilo(Boolean(atual.setup))}
      >
        <option value="">Todos os setups</option>
        {setups.map((s) => (
          <option key={s.id} value={s.id}>{s.nome}</option>
        ))}
      </select>

      <label htmlFor="filtro-ativo" className="sr-only">Filtrar por ativo</label>
      <select
        id="filtro-ativo"
        name="ativo"
        defaultValue={atual.ativo ?? ""}
        className={`${estilo(Boolean(atual.ativo))} num`}
      >
        <option value="">Todos os ativos</option>
        {ATIVOS.map((a) => (
          <option key={a.codigo} value={a.codigo}>{a.codigo} · {a.nome}</option>
        ))}
      </select>

      <button
        type="submit"
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
