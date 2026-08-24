import Link from "next/link";

import {
  contextos,
  DIMENSOES,
  matrizDasMedias,
  porDimensao,
  type Contexto,
  type Dimensao,
  type LinhaAnalisavel,
} from "@/lib/analise";
import { emR, inteiro, percentual } from "@/lib/formato";
import { AMOSTRA_MINIMA } from "@/lib/metricas";
import { curto, INCLINACOES } from "@/lib/opcoes";

/** Abaixo disso nenhum dos rankings tem o que dizer. */
const MINIMO_PARA_ANALISE = 12;

export function Contextos({
  linhas,
  tempo,
  dimensao,
  filtros,
}: {
  linhas: LinhaAnalisavel[];
  tempo: string;
  dimensao: Dimensao;
  filtros: { setup?: string; ativo?: string };
}) {
  if (linhas.length < MINIMO_PARA_ANALISE) {
    return (
      <section className="rounded-xl border border-dashed border-line-strong bg-card/50 px-6 py-10 text-center">
        <p className="text-[15px] text-ink-2">A análise de contexto abre com mais registros.</p>
        <p className="mx-auto mt-2 max-w-[520px] text-[13.5px] leading-relaxed text-ink-4">
          São <span className="num">{inteiro(linhas.length)}</span> de{" "}
          <span className="num">{MINIMO_PARA_ANALISE}</span>. Com menos que isso, qualquer
          combinação teria uma ou duas linhas — e um contexto de duas linhas a 100% não diz nada.
        </p>
      </section>
    );
  }

  const { melhores, piores, curtos } = contextos(linhas);
  const dimensoes = porDimensao(linhas, dimensao);
  const matriz = matrizDasMedias(linhas, INCLINACOES);
  const maiorNaMatriz = Math.max(...matriz.flat().map((c) => c.registros));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3.5">
        <Cartao
          titulo="Melhores contextos"
          descricao="Onde este setup, neste tempo gráfico, aparece mais forte"
          selo="ORDENADO PELO PISO"
          seloClasse="bg-accent/20 text-accent-soft"
        >
          {melhores.length === 0 ? (
            <Nenhum />
          ) : (
            melhores.map((c) => <Linha key={c.chave} contexto={c} bom />)
          )}

          {curtos.length > 0 && (
            <p className="mt-3.5 flex gap-2.5 border-t border-line pt-3.5 text-[12.5px] leading-[1.6] text-ink-4">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden>
                <circle cx="8" cy="8" r="6.2" />
                <path d="M8 5.2v3.4M8 10.9v.1" />
              </svg>
              <span>
                Fora do ranking por amostra curta:{" "}
                <span className="text-ink-3">
                  {curto(curtos[0].entrada)} · {curto(curtos[0].alinhamento)} · {curto(curtos[0].localizacao)}
                </span>{" "}
                tem <span className="num">{percentual(curtos[0].assertividade, 0)}</span> em{" "}
                <span className="num">{curtos[0].registros}</span>{" "}
                {curtos[0].registros === 1 ? "registro" : "registros"} — piso de apenas{" "}
                <span className="num">{percentual(curtos[0].piso)}</span>.
              </span>
            </p>
          )}
        </Cartao>

        <Cartao
          titulo="Piores contextos"
          descricao="Onde vale parar de operar este setup"
          selo={`MÍNIMO ${AMOSTRA_MINIMA}`}
          seloClasse="bg-loss-bg text-loss"
        >
          {piores.length === 0 ? <Nenhum /> : piores.map((c) => <Linha key={c.chave} contexto={c} />)}
        </Cartao>
      </div>

      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3.5">
        <section className="rounded-xl border border-line bg-card p-[22px]">
          <div className="mb-4">
            <h3 className="display text-[19px]">Assertividade por dimensão</h3>
            <p className="mt-1.5 text-[13px] text-ink-4">
              Escolha um campo e veja como ele se comporta sozinho
            </p>
          </div>

          <div className="mb-5 flex flex-wrap gap-[7px]">
            {DIMENSOES.map((d) => {
              const ativo = d.chave === dimensao;
              const url = new URLSearchParams({ dim: d.chave });
              if (filtros.setup) url.set("setup", filtros.setup);
              if (filtros.ativo) url.set("ativo", filtros.ativo);
              return (
                <Link
                  key={d.chave}
                  href={`/backteste/${encodeURIComponent(tempo)}?${url}#contexto`}
                  className={
                    "flex h-8 items-center rounded-lg border px-3 text-[13.5px] font-medium " +
                    (ativo
                      ? "border-accent bg-accent font-semibold text-accent-ink"
                      : "border-line-strong bg-raised text-ink-3 hover:text-ink-2")
                  }
                >
                  {d.rotulo}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-col gap-4">
            {dimensoes.map((g) => (
              <div key={g.chave}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[14px] text-ink-2">{curto(g.chave)}</span>
                  <span>
                    <span className={`num text-[16px] font-semibold ${g.assertividade >= 50 ? "text-gain" : "text-loss"}`}>
                      {percentual(g.assertividade)}
                    </span>
                    <span className="num ml-1.5 text-[12.5px] text-ink-4">· {g.registros}</span>
                  </span>
                </div>
                <span className="flex h-[9px] gap-0.5">
                  <span className="rounded-[5px] bg-gain" style={{ width: `${g.assertividade}%` }} />
                  <span className="flex-1 rounded-[5px] bg-loss" />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-card p-[22px]">
          <div className="mb-4">
            <h3 className="display text-[19px]">M20 × M200</h3>
            <p className="mt-1.5 text-[13px] text-ink-4">As duas médias cruzadas</p>
          </div>

          <div className="grid grid-cols-[76px_repeat(3,minmax(0,1fr))] gap-1.5">
            <span />
            {INCLINACOES.map((m) => (
              <span key={m} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.10em] text-ink-3">
                M200 {seta(m)}
              </span>
            ))}

            {matriz.map((linha, i) => (
              <Celulas key={INCLINACOES[i]} m20={INCLINACOES[i]} celulas={linha} maior={maiorNaMatriz} />
            ))}
          </div>

          <p className="mt-4 border-t border-line pt-3.5 text-[12.5px] leading-[1.6] text-ink-4">
            Célula com menos de <span className="num">{AMOSTRA_MINIMA}</span> registros fica sem cor
            forte — pouca amostra pinta qualquer coisa de verde.
          </p>
        </section>
      </div>
    </div>
  );
}

function Celulas({
  m20,
  celulas,
  maior,
}: {
  m20: string;
  celulas: { registros: number; assertividade: number | null }[];
  maior: number;
}) {
  return (
    <>
      <span className="flex items-center text-[10px] font-semibold uppercase tracking-[0.10em] text-ink-3">
        M20 {seta(m20)}
      </span>
      {celulas.map((c, i) => {
        const confiavel = c.registros >= AMOSTRA_MINIMA;
        const forca = confiavel ? Math.min(0.36, 0.10 + (c.registros / maior) * 0.26) : 0.07;
        const bom = (c.assertividade ?? 50) >= 50;
        return (
          <span
            key={i}
            style={{
              background:
                c.registros === 0
                  ? "var(--well)"
                  : `color-mix(in srgb, ${bom ? "var(--gain)" : "var(--loss)"} ${forca * 100}%, var(--well))`,
            }}
            className="rounded-[10px] border border-line-soft px-1.5 py-[9px] text-center"
          >
            <span className={`num block text-[15px] font-semibold ${c.assertividade === null ? "text-ink-4" : bom ? "text-gain" : "text-loss"}`}>
              {percentual(c.assertividade, 0)}
            </span>
            <span className="num mt-0.5 block text-[11px] text-ink-4">{c.registros}</span>
          </span>
        );
      })}
    </>
  );
}

const seta = (inclinacao: string) =>
  inclinacao === "Inclinada para cima" ? "↑" : inclinacao === "Inclinada para baixo" ? "↓" : "plana";

function Cartao({
  titulo,
  descricao,
  selo,
  seloClasse,
  children,
}: {
  titulo: string;
  descricao: string;
  selo: string;
  seloClasse: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-card p-[22px]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="display text-[19px]">{titulo}</h3>
          <p className="mt-1.5 text-[13px] text-ink-4">{descricao}</p>
        </div>
        <span className={`inline-flex h-6 shrink-0 items-center rounded-[7px] px-2.5 text-[11.5px] font-semibold tracking-[0.05em] ${seloClasse}`}>
          {selo}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function Linha({ contexto, bom = false }: { contexto: Contexto; bom?: boolean }) {
  const cor = bom ? "text-gain" : "text-loss";
  const barra = bom ? "bg-gain" : "bg-loss";
  const suave = bom ? "bg-gain/30" : "bg-loss/30";

  // No melhor mostra o piso; no pior, o teto. É de onde vem a confiança de cada um.
  const limite = bom ? contexto.piso : contexto.teto;
  const solido = bom ? contexto.piso : contexto.assertividade;
  const claro = bom ? contexto.assertividade - contexto.piso : contexto.teto - contexto.assertividade;

  return (
    <div className="rounded-[10px] border border-line-soft bg-well px-4 py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold leading-[1.35] text-ink">
            {curto(contexto.entrada)} · {curto(contexto.alinhamento)}
          </p>
          <p className="mt-1.5 text-[13px] text-ink-3">{curto(contexto.localizacao)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`num text-[21px] font-semibold tracking-[-0.03em] ${cor}`}>
            {percentual(contexto.assertividade)}
          </p>
          <p className="num mt-1 text-[12px] text-ink-4">
            {bom ? "piso" : "teto"} {percentual(limite)}
          </p>
        </div>
      </div>

      <span className="mt-3 flex h-[5px] overflow-hidden rounded-[3px] bg-track">
        <span className={barra} style={{ width: `${solido}%` }} />
        <span className={suave} style={{ width: `${Math.max(0, claro)}%` }} />
      </span>

      <div className="mt-2.5 flex justify-between text-[12.5px]">
        <span className="num text-ink-3">{contexto.registros} registros</span>
        <span className={`num ${cor}`}>{emR(contexto.riscoRetorno)}</span>
      </div>
    </div>
  );
}

function Nenhum() {
  return (
    <p className="rounded-[10px] border border-line-soft bg-well px-4 py-6 text-center text-[13.5px] text-ink-4">
      Nenhuma combinação chegou a {AMOSTRA_MINIMA} registros ainda.
    </p>
  );
}
