import Link from "next/link";

import type { Moeda } from "@/lib/ativos";
import { CAMPOS_DE_EXECUCAO, carregarPlano, type SetupDoPlano } from "@/lib/dados/plano";
import { data as fData, hora, inteiro, moeda, percentual, VAZIO } from "@/lib/formato";

export const metadata = { title: "Plano de trade — AION" };

export default async function PaginaPlano({ searchParams }: PageProps<"/plano">) {
  const { conta: contaId } = await searchParams;
  const { plano, conta, comPlano, semPlano } = await carregarPlano(
    typeof contaId === "string" ? contaId : undefined,
  );

  const vazio = !plano && comPlano.length === 0;

  return (
    <>
      <header className="mb-[18px] flex items-end justify-between">
        <div>
          <h1 className="display text-[30px] leading-[1.05]">Plano de trade</h1>
          <p className="mt-2 text-[14px] text-ink-3">
            {comPlano.length === 0
              ? "Nenhum setup com plano de execução ainda"
              : `${comPlano.length} ${comPlano.length === 1 ? "setup" : "setups"} no plano`}
            {plano?.revisado_em && ` · última revisão em ${fData(plano.revisado_em)}`}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Link
            href={`/imprimir/plano${conta ? `?conta=${conta.id}` : ""}`}
            target="_blank"
            className="flex h-[38px] items-center gap-2 rounded-lg border border-line-strong bg-raised px-[15px] text-[14.5px] font-medium text-ink-2"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4.5 6V2.4h7V6" />
              <rect x="2.4" y="6" width="11.2" height="5" rx="1.4" />
              <path d="M4.5 11h7v2.6h-7z" />
            </svg>
            Imprimir
          </Link>
          <Link
            href="/plano/editar"
            className="flex h-[38px] items-center gap-2 rounded-lg bg-accent px-[15px] text-[14.5px] font-semibold text-accent-ink"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11.3 2.7a1.6 1.6 0 0 1 2.3 2.3L5.5 13 2 14l1-3.5z" />
            </svg>
            Editar plano
          </Link>
        </div>
      </header>

      {vazio && (
        <div className="mb-4 rounded-xl border border-dashed border-line-strong bg-card/50 p-12 text-center">
          <p className="text-[15px] text-ink-2">O plano ainda está em branco.</p>
          <p className="mx-auto mt-2 max-w-[520px] text-[13.5px] leading-relaxed text-ink-4">
            O pré-mercado se escreve em <Link href="/plano/editar">Editar plano</Link>. A parte de
            execução vive dentro de cada <Link href="/setup">setup</Link> — são os seis campos do
            formulário de edição.
          </p>
        </div>
      )}

      {/* 1. PRÉ-MERCADO */}
      <section className="mb-[18px] rounded-xl border border-line bg-card p-6">
        <h2 className="mb-5 flex items-baseline gap-3">
          <span className="num text-[14px] font-semibold text-accent-soft">1</span>
          <span className="display text-[20px]">Pré-mercado</span>
        </h2>

        <div className="grid grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)] gap-7">
          <div className="flex flex-col gap-5">
            <div>
              <Rotulo>Gerenciamento</Rotulo>
              <div className="mt-3 flex flex-col gap-3.5 rounded-[10px] border border-line-soft bg-well p-[17px]">
                <Limite titulo="MLPT" descricao="perda máxima por trade" valor={conta?.mlpt} moedaConta={conta?.moeda ?? "USD"} />
                <span className="h-px bg-line" />
                <Limite titulo="MLPD" descricao="perda máxima do dia" valor={conta?.mlpd} moedaConta={conta?.moeda ?? "USD"} />
              </div>
              <p className="mt-2.5 flex items-center gap-2 text-[12px] text-ink-4">
                <span className="inline-block size-[5px] rounded-full bg-accent-soft" />
                {conta ? (
                  <>vem da conta <span className="num">{conta.numero}</span>, não se digita aqui</>
                ) : (
                  <>cadastre uma conta para estes dois números aparecerem</>
                )}
              </p>
            </div>

            <div>
              <Rotulo>Ativos</Rotulo>
              <div className="mt-3 flex flex-wrap gap-[7px]">
                {plano?.ativos?.length ? (
                  plano.ativos.map((a) => (
                    <span key={a} className="num inline-flex h-[26px] items-center rounded-[7px] bg-raised px-2.5 text-[13px] font-semibold text-ink-2">
                      {a}
                    </span>
                  ))
                ) : (
                  <span className="text-[13.5px] text-ink-4">nenhum ativo definido</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <Rotulo>Regras</Rotulo>
            <div className="mt-2.5">
              {plano?.janela_inicio && plano.janela_fim && (
                <Item>
                  Janela operacional:{" "}
                  <strong className="num text-ink">{hora(plano.janela_inicio)} às {hora(plano.janela_fim)}</strong>.
                </Item>
              )}
              {(plano?.min_trades !== null || plano?.max_trades !== null) && plano && (
                <Item>
                  {plano.min_trades !== null && <>Mínimo <strong className="num text-ink">{plano.min_trades}</strong> trades</>}
                  {plano.min_trades !== null && plano.max_trades !== null && " / "}
                  {plano.max_trades !== null && <>máximo <strong className="num text-ink">{plano.max_trades}</strong> trades</>}.
                </Item>
              )}
              {plano?.max_loss_seguidos !== null && plano?.max_loss_seguidos !== undefined && (
                <Item>
                  Após <strong className="num text-ink">{plano.max_loss_seguidos} loss seguidos</strong>: encerro o dia.
                </Item>
              )}
              {plano?.regras?.map((r, i) => <Item key={i}>{r}</Item>)}
              {!plano && <p className="text-[13.5px] text-ink-4">nenhuma regra escrita</p>}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <Rotulo>Checklist de abertura</Rotulo>
              <div className="mt-2.5">
                {plano?.checklist_abertura?.length ? (
                  plano.checklist_abertura.map((c, i) => <Caixa key={i}>{c}</Caixa>)
                ) : (
                  <p className="text-[13.5px] text-ink-4">nada listado</p>
                )}
              </div>
            </div>
            <div>
              <Rotulo>Checklist de fechamento</Rotulo>
              <div className="mt-2.5">
                {plano?.checklist_fechamento?.length ? (
                  plano.checklist_fechamento.map((c, i) => <Caixa key={i}>{c}</Caixa>)
                ) : (
                  <p className="text-[13.5px] text-ink-4">nada listado</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. EXECUÇÃO */}
      <h2 className="mb-3.5 flex items-baseline gap-3">
        <span className="num text-[14px] font-semibold text-accent-soft">2</span>
        <span className="display text-[20px]">Execução</span>
        <span className="text-[13.5px] text-ink-4">
          um bloco por setup — cada um editado no próprio setup
        </span>
      </h2>

      <div className="flex flex-col gap-3.5">
        {comPlano.map((setup) => <BlocoDoSetup key={setup.id} setup={setup} />)}
      </div>

      {semPlano.length > 0 && (
        <p className="mt-3.5 rounded-[10px] border border-line-soft bg-well px-[18px] py-3.5 text-[13.5px] text-ink-4">
          Sem plano de execução preenchido:{" "}
          {semPlano.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <Link href={`/setup/${s.id}`}>{s.nome}</Link>
            </span>
          ))}
          . Campo vazio não aparece aqui nem na folha impressa.
        </p>
      )}

      {plano?.nota_rodape && (
        <div className="mt-[18px] flex items-start gap-3.5 rounded-[10px] border border-line-soft bg-well px-[22px] py-[18px]">
          <svg width="19" height="19" viewBox="0 0 16 16" fill="none" stroke="var(--accent-soft)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden>
            <path d="M4.5 3.4h7l2 2.6-5.5 6.6L2.5 6z" />
            <path d="M2.5 6h11" />
          </svg>
          <p className="text-[14.5px] leading-[1.6] text-ink-2">{plano.nota_rodape}</p>
        </div>
      )}
    </>
  );
}

function BlocoDoSetup({ setup }: { setup: SetupDoPlano }) {
  return (
    <section className="rounded-xl border border-line bg-card px-6 py-5">
      <div className="mb-[18px] flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <h3 className="display text-[21px]">{setup.nome}</h3>
          {setup.backtestes > 0 && (
            <span className="inline-flex h-[26px] items-center rounded-[7px] bg-accent/20 px-2.5 text-[13px] font-semibold text-accent-soft">
              <span className="num">{inteiro(setup.backtestes)}</span>
              <span className="mx-1 font-normal">backtestes ·</span>
              <span className="num">{percentual(setup.assertividade, 0)}</span>
            </span>
          )}
        </div>
        <Link href={`/setup/${setup.id}`} aria-label={`Editar ${setup.nome}`} className="text-ink-4 hover:text-accent-soft">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11.3 2.7a1.6 1.6 0 0 1 2.3 2.3L5.5 13 2 14l1-3.5z" />
          </svg>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-x-[26px] gap-y-[22px]">
        {CAMPOS_DE_EXECUCAO.map(([campo, titulo]) =>
          setup[campo] ? (
            <div key={campo} className="flex flex-col gap-2.5">
              <Rotulo>{titulo}</Rotulo>
              <p className="whitespace-pre-line text-[13.5px] leading-[1.6] text-ink-2">{setup[campo]}</p>
            </div>
          ) : null,
        )}
      </div>
    </section>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3">{children}</span>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 py-1.5 text-[13.5px] leading-[1.55] text-ink-2">
      <span className="mt-2 size-[5px] shrink-0 rounded-full bg-accent-soft" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Caixa({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 py-1.5 text-[13.5px] leading-[1.55] text-ink-2">
      <span className="mt-0.5 size-[15px] shrink-0 rounded-[4px] border-[1.5px] border-line-strong" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Limite({
  titulo,
  descricao,
  valor,
  moedaConta,
}: {
  titulo: string;
  descricao: string;
  valor?: number;
  moedaConta: Moeda;
}) {
  return (
    <span className="flex items-baseline justify-between">
      <span>
        <span className="num block text-[13px] text-ink-3">{titulo}</span>
        <span className="mt-0.5 block text-[11.5px] text-ink-4">{descricao}</span>
      </span>
      <span className="num text-[21px] font-semibold text-loss">
        {valor === undefined ? VAZIO : moeda(valor, moedaConta).replace(",00", "")}
      </span>
    </span>
  );
}
