import Link from "next/link";

import { resumoPorTempo, type ResumoTempo } from "@/lib/dados/backtestes";
import { emR, inteiro, percentual, VAZIO } from "@/lib/formato";

export const metadata = { title: "Backteste — AION" };

export default async function PaginaBackteste() {
  const { porTempo, geral } = await resumoPorTempo();

  return (
    <>
      <header className="mb-5">
        <h1 className="display text-[30px] leading-[1.05]">Backteste</h1>
        <p className="mt-2 text-[14px] text-ink-3">Escolha o tempo gráfico para estudar</p>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Cartao titulo="Total de backtestes" valor={inteiro(geral.registros)} />
        <Cartao titulo="Assertividade geral" valor={percentual(geral.assertividade)} />
        <Cartao
          titulo="R:R médio dos gains"
          valor={emR(geral.riscoRetorno)}
          cor={
            geral.riscoRetorno === null
              ? "text-ink-4"
              : geral.riscoRetorno >= 0
                ? "text-gain"
                : "text-loss"
          }
        />
      </div>

      <section className="rounded-xl border border-line bg-card p-[22px]">
        <div className="mb-4">
          <h2 className="display text-[19px]">Tempos gráficos</h2>
          <p className="mt-1.5 text-[13px] text-ink-4">
            Os sete são fixos — não se cria nem se remove
          </p>
        </div>

        <div className="mb-2 grid grid-cols-[78px_74px_1fr_96px_26px] gap-[18px] px-[18px] pb-2">
          <Rotulo>Tempo</Rotulo>
          <Rotulo>Registros</Rotulo>
          <Rotulo>Gain / loss</Rotulo>
          <Rotulo direita>R:R dos gains</Rotulo>
          <span />
        </div>

        <ul className="flex flex-col gap-2">
          {porTempo.map((t) => (
            <li key={t.tempo}>
              <LinhaTempo resumo={t} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function LinhaTempo({ resumo }: { resumo: ResumoTempo }) {
  const vazio = resumo.registros === 0;

  return (
    <Link
      href={`/backteste/${encodeURIComponent(resumo.tempo)}`}
      className={
        "grid grid-cols-[78px_74px_1fr_96px_26px] items-center gap-[18px] rounded-[10px] border border-line-soft bg-well px-[18px] py-[15px] transition-colors hover:border-line-strong " +
        (vazio ? "opacity-55" : "")
      }
    >
      <span className="num inline-flex h-9 w-[62px] items-center justify-center rounded-lg border border-line-strong bg-raised text-[16px] font-semibold">
        {resumo.tempo}
      </span>

      <span className={`num text-[16px] ${vazio ? "text-ink-4" : "text-ink-2"}`}>
        {inteiro(resumo.registros)}
      </span>

      <span className="block">
        <span className="flex h-[9px] gap-0.5">
          {vazio ? (
            <span className="flex-1 rounded-[5px] bg-track" />
          ) : (
            <>
              <span
                className="rounded-[5px] bg-gain"
                style={{ width: `${(resumo.gains / resumo.registros) * 100}%` }}
              />
              <span className="flex-1 rounded-[5px] bg-loss" />
            </>
          )}
        </span>
        <span className="mt-2 flex justify-between text-[12.5px]">
          {vazio ? (
            <span className="text-ink-4">nenhum estudo ainda</span>
          ) : (
            <>
              <span className="num text-gain">{resumo.gains} gain</span>
              <span className="num text-loss">{resumo.losses} loss</span>
            </>
          )}
        </span>
      </span>

      <span
        className={
          "num text-right text-[17px] font-semibold " +
          (resumo.riscoRetorno === null
            ? "text-ink-4"
            : resumo.riscoRetorno >= 0
              ? "text-gain"
              : "text-loss")
        }
      >
        {resumo.riscoRetorno === null ? VAZIO : emR(resumo.riscoRetorno)}
      </span>

      <span className="text-right text-ink-4">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 3l5 5-5 5" />
        </svg>
      </span>
    </Link>
  );
}

function Rotulo({ children, direita }: { children: React.ReactNode; direita?: boolean }) {
  return (
    <span
      className={`text-[10.5px] font-semibold uppercase tracking-[0.10em] text-ink-3 ${direita ? "text-right" : ""}`}
    >
      {children}
    </span>
  );
}

function Cartao({ titulo, valor, cor = "" }: { titulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-[22px] py-[18px]">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3">{titulo}</p>
      <p className={`num mt-[11px] text-[32px] font-semibold tracking-[-0.035em] ${cor}`}>{valor}</p>
    </div>
  );
}
