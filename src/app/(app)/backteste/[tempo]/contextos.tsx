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

const TOOLTIP_MELHORES =
  "A porcentagem grande é o que já foi observado. \"Pior cenário\" é quanto essa taxa pode cair " +
  "considerando que a amostra é limitada — quanto mais registros, mais perto os dois números ficam " +
  "um do outro. Ranqueamos por esse número, não pelo bruto, pra amostra pequena com sorte não subir no ranking.";

const TOOLTIP_PIORES =
  "A porcentagem grande é o que já foi observado. \"Melhor cenário\" é o quanto essa taxa poderia " +
  "chegar dando o benefício da dúvida à amostra. Se mesmo assim o número é baixo, dá pra confiar que " +
  "o contexto é fraco de verdade, não azar.";

export function Contextos({
  linhas,
  tempo,
  dimensao,
  filtros,
  setups,
}: {
  linhas: LinhaAnalisavel[];
  tempo: string;
  dimensao: Dimensao;
  filtros: { setup?: string; ativo?: string; operacao?: string };
  setups: { id: string; nome: string }[];
}) {
  const amostraInsuficiente = linhas.length < MINIMO_PARA_ANALISE;

  const urlComSetup = (setupId: string) => {
    const url = new URLSearchParams();
    if (dimensao) url.set("dim", dimensao);
    if (filtros.ativo) url.set("ativo", filtros.ativo);
    if (filtros.operacao) url.set("operacao", filtros.operacao);
    if (setupId) url.set("setup", setupId);
    return `/backteste/${encodeURIComponent(tempo)}?${url}#contexto`;
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-[7px]">
        <span className="mr-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-4">Setup</span>
        <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-line-soft bg-well p-[3px]">
          <Link
            href={urlComSetup("")}
            className={
              "flex h-7 items-center rounded-md px-3 text-[13.5px] font-medium transition-colors duration-150 " +
              (!filtros.setup
                ? "bg-accent font-semibold text-accent-ink shadow-sm"
                : "text-ink-3 hover:bg-raised hover:text-ink-2")
            }
          >
            Todos os setups
          </Link>
          {setups.map((s) => (
            <Link
              key={s.id}
              href={urlComSetup(s.id)}
              className={
                "flex h-7 items-center rounded-md px-3 text-[13.5px] font-medium transition-colors duration-150 " +
                (filtros.setup === s.id
                  ? "bg-accent font-semibold text-accent-ink shadow-sm"
                  : "text-ink-3 hover:bg-raised hover:text-ink-2")
              }
            >
              {s.nome}
            </Link>
          ))}
        </div>
      </div>

      {amostraInsuficiente ? (
        <section className="rounded-xl border border-dashed border-line-strong bg-card/50 px-6 py-10 text-center">
          <p className="text-[15px] text-ink-2">A análise de contexto abre com mais registros.</p>
          <p className="mx-auto mt-2 max-w-[520px] text-[13.5px] leading-relaxed text-ink-4">
            São <span className="num">{inteiro(linhas.length)}</span> de{" "}
            <span className="num">{MINIMO_PARA_ANALISE}</span>. Com menos que isso, qualquer
            combinação teria uma ou duas linhas — e um contexto de duas linhas a 100% não diz nada.
          </p>
        </section>
      ) : (
        <ConteudoComAmostra
          linhas={linhas}
          tempo={tempo}
          dimensao={dimensao}
          filtros={filtros}
        />
      )}
    </div>
  );
}

function ConteudoComAmostra({
  linhas,
  tempo,
  dimensao,
  filtros,
}: {
  linhas: LinhaAnalisavel[];
  tempo: string;
  dimensao: Dimensao;
  filtros: { setup?: string; ativo?: string; operacao?: string };
}) {
  const dimensoes = porDimensao(linhas, dimensao);
  const matriz = matrizDasMedias(linhas, INCLINACOES);
  const maiorNaMatriz = Math.max(...matriz.flat().map((c) => c.registros));

  return (
    <>
      {!filtros.setup ? (
        <div className="grid grid-cols-2 gap-3.5">
          <Cartao
            titulo="Melhores contextos"
            descricao="Onde este setup, neste tempo gráfico, aparece mais forte"
            selo="ESCOLHA UM SETUP"
            seloTom="accent"
            tooltip={TOOLTIP_MELHORES}
          >
            <SemSetup />
          </Cartao>
          <Cartao
            titulo="Piores contextos"
            descricao="Onde vale parar de operar este setup"
            selo="ESCOLHA UM SETUP"
            seloTom="loss"
            tooltip={TOOLTIP_PIORES}
          >
            <SemSetup />
          </Cartao>
        </div>
      ) : (
        <MelhoresPiores linhas={linhas} />
      )}

      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3.5">
        <section className="rounded-xl border border-line bg-card p-[22px] transition-colors duration-150 hover:border-line-strong">
          <div className="mb-4">
            <h3 className="display text-[19px]">Assertividade por dimensão</h3>
            <p className="mt-1.5 text-[13px] text-ink-3">
              Escolha um campo e veja como ele se comporta sozinho
            </p>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-0.5 rounded-lg border border-line-soft bg-well p-[3px]">
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
                    "flex h-7 items-center rounded-md px-3 text-[13.5px] font-medium transition-colors duration-150 " +
                    (ativo
                      ? "bg-accent font-semibold text-accent-ink shadow-sm"
                      : "text-ink-3 hover:bg-raised hover:text-ink-2")
                  }
                >
                  {d.rotulo}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-col gap-4">
            {dimensoes.map((g) => (
              <div key={g.chave} className="-mx-2 rounded-lg px-2 py-1 transition-colors duration-150 hover:bg-well">
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
                  <span className="rounded-full bg-gain" style={{ width: `${g.assertividade}%` }} />
                  <span className="flex-1 rounded-full bg-loss" />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-card p-[22px] transition-colors duration-150 hover:border-line-strong">
          <div className="mb-4">
            <h3 className="display text-[19px]">M20 × M200</h3>
            <p className="mt-1.5 text-[13px] text-ink-3">As duas médias cruzadas</p>
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
    </>
  );
}

/**
 * Misturar entrada/alinhamento/localização de setups diferentes não diz
 * nada — cada setup lê essas dimensões do jeito dele. Por isso essa análise
 * só roda depois que um setup é escolhido no filtro (ver `Contextos` acima).
 */
function MelhoresPiores({ linhas }: { linhas: LinhaAnalisavel[] }) {
  const { melhores, piores, curtos, candidatos } = contextos(linhas);

  return (
    <div className="grid grid-cols-2 gap-3.5">
      <Cartao
        titulo="Melhores contextos"
        descricao="Onde este setup, neste tempo gráfico, aparece mais forte"
        selo="ORDENADO PELO PIOR CENÁRIO"
        seloTom="accent"
        tooltip={TOOLTIP_MELHORES}
      >
        {melhores.length === 0 ? (
          <Nenhum semDestaque={candidatos > 0} bom />
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
              {curtos[0].registros === 1 ? "registro" : "registros"} — no pior cenário cai pra apenas{" "}
              <span className="num">{percentual(curtos[0].piso)}</span>.
            </span>
          </p>
        )}
      </Cartao>

      <Cartao
        titulo="Piores contextos"
        descricao="Onde vale parar de operar este setup"
        selo={`MÍNIMO ${AMOSTRA_MINIMA}`}
        seloTom="loss"
        tooltip={TOOLTIP_PIORES}
      >
        {piores.length === 0 ? (
          <Nenhum semDestaque={candidatos > 0} />
        ) : (
          piores.map((c) => <Linha key={c.chave} contexto={c} />)
        )}
      </Cartao>
    </div>
  );
}

function SemSetup() {
  return (
    <p className="rounded-[10px] border border-line-soft bg-well px-4 py-6 text-center text-[13.5px] leading-relaxed text-ink-4">
      Escolha um setup no filtro acima. Misturar entrada, alinhamento e localização de setups
      diferentes não diz nada — cada um lê essas dimensões do seu jeito.
    </p>
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
            className="rounded-[10px] border border-line-soft px-1.5 py-[9px] text-center transition-transform duration-150 hover:z-10 hover:scale-105 hover:shadow-lg"
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
  seloTom,
  tooltip,
  children,
}: {
  titulo: string;
  descricao: string;
  selo: string;
  seloTom: "accent" | "loss";
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-card p-[22px] transition-all duration-150 hover:border-line-strong hover:shadow-lg">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="display flex items-center gap-1.5 text-[19px]">
            {titulo}
            {tooltip && <InfoTooltip texto={tooltip} />}
          </h3>
          <p className="mt-1.5 text-[13px] text-ink-3">{descricao}</p>
        </div>
        <span className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-2.5 text-[11px] font-semibold tracking-[0.05em] text-ink-3">
          <span className={`size-[6px] rounded-full ${seloTom === "accent" ? "bg-accent-soft" : "bg-loss"}`} />
          {selo}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

/** Ícone de ajuda com balão em CSS puro — sem lib de UI no projeto, hover/foco bastam pro fluxo de mouse do app. */
function InfoTooltip({ texto }: { texto: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="O que isso significa"
        className="flex h-4 w-4 items-center justify-center rounded-full text-ink-4 hover:text-ink-2 focus-visible:text-ink-2 focus-visible:outline-none"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 7.2v3.4M8 5.1v.1" />
        </svg>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-[240px] -translate-x-1/2 rounded-[10px] border border-line-strong bg-raised px-3 py-2.5 font-sans text-[12.5px] font-normal leading-relaxed tracking-normal text-ink-2 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {texto}
      </span>
    </span>
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
    <div className="rounded-[10px] border border-line-soft bg-well px-4 py-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:bg-raised hover:shadow-lg">
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
          <p className="mt-1 text-[12px] text-ink-4">
            {bom ? "pior cenário" : "melhor cenário"} <span className="num">{percentual(limite)}</span>
          </p>
        </div>
      </div>

      <span className="mt-3 flex h-[5px] overflow-hidden rounded-full bg-track">
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

function Nenhum({ semDestaque = false, bom = false }: { semDestaque?: boolean; bom?: boolean }) {
  return (
    <p className="rounded-[10px] border border-line-soft bg-well px-4 py-6 text-center text-[13.5px] text-ink-4">
      {semDestaque
        ? bom
          ? "Nenhuma combinação provou ser boa o bastante ainda — mesmo no pior cenário, nenhuma passa de 50%."
          : "Nenhuma combinação provou ser ruim o bastante ainda — mesmo no melhor cenário, todas passam de 50%."
        : `Nenhuma combinação chegou a ${AMOSTRA_MINIMA} registros ainda.`}
    </p>
  );
}
