import { Arco } from "@/components/marca";
import type { Moeda } from "@/lib/ativos";
import { CAMPOS_DE_EXECUCAO, carregarPlano } from "@/lib/dados/plano";
import { data as fData, hora, moeda } from "@/lib/formato";

import { BotaoImprimir } from "./botao";

export const metadata = { title: "Plano de trade — AION" };
export const dynamic = "force-dynamic";

/**
 * Folha A4 paisagem, uma página. Fora do grupo (app) de propósito: sem barra
 * lateral, e com cores fixas de papel — o tema do app não vale aqui.
 */
export default async function ImprimirPlano({ searchParams }: PageProps<"/imprimir/plano">) {
  const { conta: contaId } = await searchParams;
  const { plano, conta, comPlano } = await carregarPlano(
    typeof contaId === "string" ? contaId : undefined,
  );

  const colunas = CAMPOS_DE_EXECUCAO;

  return (
    <div className="min-h-dvh bg-[#4a4a46] py-8 print:bg-white print:py-0">
      {/* A regra de página fica aqui, não no globals: só esta rota é impressa. */}
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        @media print { html, body { background: #fff !important; } }
      `}</style>
      <BotaoImprimir />

      <div className="mx-auto flex h-[794px] w-[1123px] flex-col bg-white px-7 py-[26px] text-[#1a1a18] shadow-2xl print:shadow-none">
        <header className="flex items-end justify-between border-b-[1.4px] border-[#1a1a18] pb-[11px]">
          <div className="flex items-center gap-2.5">
            <span className="[&_svg]:!stroke-[#1a1a18]"><Arco tamanho={19} /></span>
            <span className="display text-[17px]" style={{ letterSpacing: "0.20em", paddingLeft: "0.20em" }}>AION</span>
            <span className="mx-1 h-4 w-px bg-[#c9c8c0]" />
            <span className="display text-[17px]">Plano de trade</span>
          </div>
          <div className="text-right text-[8.4px] leading-[1.5] text-[#6b6b63]">
            {conta && (
              <p>
                Conta <span className="num font-semibold text-[#1a1a18]">{conta.numero}</span> · {conta.tipo_conta}
              </p>
            )}
            {plano?.revisado_em && <p>Revisão <span className="num">{fData(plano.revisado_em)}</span></p>}
          </div>
        </header>

        <div className="grid flex-1 grid-cols-[268px_minmax(0,1fr)] gap-[22px] pt-3.5">
          {/* 1. PRÉ-MERCADO */}
          <section className="rounded-[5px] border-[0.5px] border-[#c9c8c0] px-[15px] py-[13px]">
            <h2 className="mb-[7px] text-[10px] font-bold text-[#4a3cc4]">1. Pré-mercado</h2>

            <Sub>Gerenciamento</Sub>
            <div className="flex gap-2">
              <Limite titulo="MLPT · por trade" valor={conta?.mlpt} moedaConta={conta?.moeda ?? "USD"} />
              <Limite titulo="MLPD · por dia" valor={conta?.mlpd} moedaConta={conta?.moeda ?? "USD"} />
            </div>

            {plano?.ativos && plano.ativos.length > 0 && (
              <>
                <Sub>Ativos</Sub>
                <p>
                  {plano.ativos.map((a) => (
                    <span key={a} className="num mb-[3px] mr-[3px] inline-block rounded-[4px] border-[0.5px] border-[#c9c8c0] px-1.5 py-0.5 text-[8px] font-semibold">
                      {a}
                    </span>
                  ))}
                </p>
              </>
            )}

            <Sub>Regras</Sub>
            {plano?.janela_inicio && plano.janela_fim && (
              <Bala>Janela operacional: <strong className="num">{hora(plano.janela_inicio)} às {hora(plano.janela_fim)}</strong>.</Bala>
            )}
            {plano && (plano.min_trades !== null || plano.max_trades !== null) && (
              <Bala>
                {plano.min_trades !== null && <>Mínimo <strong className="num">{plano.min_trades}</strong> trades</>}
                {plano.min_trades !== null && plano.max_trades !== null && " / "}
                {plano.max_trades !== null && <>máximo <strong className="num">{plano.max_trades}</strong> trades</>}.
              </Bala>
            )}
            {plano?.max_loss_seguidos != null && (
              <Bala>Após <strong>{plano.max_loss_seguidos} loss seguidos</strong>: encerro o dia.</Bala>
            )}
            {plano?.regras?.map((r, i) => <Bala key={i}>{r}</Bala>)}

            {plano?.checklist_abertura && plano.checklist_abertura.length > 0 && (
              <>
                <Sub>Checklist de abertura</Sub>
                {plano.checklist_abertura.map((c, i) => <Caixa key={i}>{c}</Caixa>)}
              </>
            )}

            {plano?.checklist_fechamento && plano.checklist_fechamento.length > 0 && (
              <>
                <Sub>Checklist de fechamento</Sub>
                {plano.checklist_fechamento.map((c, i) => <Caixa key={i}>{c}</Caixa>)}
              </>
            )}
          </section>

          {/* 2. EXECUÇÃO */}
          <section className="flex flex-col rounded-[5px] border-[0.5px] border-[#c9c8c0] px-[15px] py-[13px]">
            <h2 className="mb-[7px] text-[10px] font-bold text-[#4a3cc4]">2. Execução</h2>

            {comPlano.length === 0 ? (
              <p className="text-[8.4px] text-[#6b6b63]">
                Nenhum setup com plano de execução preenchido.
              </p>
            ) : (
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: 58 }} />
                  {colunas.map(([campo]) => <col key={campo} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th className="border-[0.5px] border-[#c9c8c0] bg-[#f0efea] p-[5px] px-1.5" />
                    {colunas.map(([campo, titulo]) => (
                      <th key={campo} className="border-[0.5px] border-[#c9c8c0] bg-[#f0efea] p-[5px] px-1.5 text-left text-[7.6px] font-bold uppercase tracking-[0.06em] text-[#3a3a34]">
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comPlano.map((setup) => (
                    <tr key={setup.id}>
                      <td className="border-[0.5px] border-[#c9c8c0] bg-[#f6f5f1] p-1.5 text-center align-middle text-[8.4px] font-bold">
                        {setup.nome}
                      </td>
                      {colunas.map(([campo]) => (
                        <td key={campo} className="whitespace-pre-line border-[0.5px] border-[#c9c8c0] p-1.5 align-top text-[7.6px] leading-[1.5] text-[#2a2a26]">
                          {setup[campo] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {plano?.nota_rodape && (
              <p className="mt-auto pt-[11px] text-[8.4px] italic leading-[1.5] text-[#4a4a44]">
                {plano.nota_rodape}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-[5px] mt-[9px] text-[8px] font-bold uppercase tracking-[0.10em] text-[#6b6b63]">
      {children}
    </h3>
  );
}

function Bala({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 py-0.5 text-[8.6px] leading-[1.45] text-[#2a2a26]">
      <span className="mt-[5px] size-[3px] shrink-0 rounded-full bg-[#4a3cc4]" />
      <span>{children}</span>
    </p>
  );
}

function Caixa({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 py-0.5 text-[8.6px] leading-[1.45] text-[#2a2a26]">
      <span className="mt-px size-2 shrink-0 rounded-[2px] border border-[#a8a89e]" />
      <span>{children}</span>
    </p>
  );
}

function Limite({ titulo, valor, moedaConta }: { titulo: string; valor?: number; moedaConta: Moeda }) {
  return (
    <span className="flex-1 rounded-[4px] border-[0.5px] border-[#c9c8c0] px-[9px] py-[7px]">
      <span className="num block text-[7.6px] text-[#6b6b63]">{titulo}</span>
      <span className="num mt-0.5 block text-[16px] font-semibold text-[#b3243c]">
        {valor === undefined ? "—" : moeda(valor, moedaConta).replace(",00", "")}
      </span>
    </span>
  );
}
