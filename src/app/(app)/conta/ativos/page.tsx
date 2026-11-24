import Link from "next/link";

import { BotaoRemover } from "@/components/botao-remover";
import { listarAtivos } from "@/lib/dados/ativos";
import { moeda } from "@/lib/formato";

import { removerAtivo } from "./acoes";
import { FormularioAtivo } from "./formulario";

export const metadata = { title: "Ativos — AION" };

const comoTexto = (n: number) => String(n).replace(".", ",");

export default async function PaginaAtivos({ searchParams }: PageProps<"/conta/ativos">) {
  const { editar, erro } = await searchParams;
  const ativos = await listarAtivos();
  const emEdicao = typeof editar === "string" ? (ativos.find((a) => a.id === editar) ?? null) : null;

  return (
    <>
      <header className="mb-5">
        <p className="mb-1.5 text-[14px] text-ink-3">
          <Link href="/conta">Conta</Link>
        </p>
        <h1 className="display text-[30px] leading-[1.05]">Ativos</h1>
        <p className="mt-2 max-w-[560px] text-[14px] text-ink-3">
          Os ativos que você opera, com o padrão de cada um em tick. Em Corretoras, cada corretora
          recebe uma cópia desse padrão e você ajusta só o que for diferente nela.
        </p>
      </header>

      {typeof erro === "string" && (
        <p role="alert" className="mb-4 rounded-[10px] border border-loss/40 bg-loss-bg px-4 py-3 text-[14px] text-loss">
          {erro}
        </p>
      )}

      <div className="flex items-start gap-5 med:flex-col med:items-stretch">
        <section className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-line bg-card p-[22px]">
          {ativos.length === 0 ? (
            <p className="text-[14.5px] text-ink-2">Nenhum ativo ainda. Cadastre o primeiro ao lado.</p>
          ) : (
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                  <th className="pb-2 pr-3">Ativo</th>
                  <th className="pb-2 pr-3">Tick</th>
                  <th className="pb-2 pr-3">Valor do tick</th>
                  <th className="pb-2 pr-3">Valor do ponto</th>
                  <th className="pb-2 pr-3">Unidade</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {ativos.map((a) => (
                  <tr key={a.id} className={"border-t border-line-soft " + (a.id === emEdicao?.id ? "bg-raised/40" : "")}>
                    <td className="py-2.5 pr-3">
                      <span className="num font-semibold">{a.codigo}</span>
                      <span className="ml-2 text-[13px] text-ink-3">{a.nome}</span>
                    </td>
                    <td className="num py-2.5 pr-3">{comoTexto(a.tamanhoTick)}</td>
                    <td className="num py-2.5 pr-3">{moeda(a.valorTick, a.moeda)}</td>
                    <td className="num py-2.5 pr-3 font-semibold text-accent-soft">{moeda(a.valorPonto, a.moeda)}</td>
                    <td className="py-2.5 pr-3 text-ink-3">{a.unidade}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-3 text-ink-4">
                        <Link href={`/conta/ativos?editar=${a.id}`} aria-label={`Editar ${a.codigo}`} className="hover:text-ink-2">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11.3 2.7a1.6 1.6 0 0 1 2.3 2.3L5.5 13 2 14l1-3.5z" />
                          </svg>
                        </Link>
                        <BotaoRemover
                          acao={removerAtivo}
                          campos={{ id: a.id }}
                          rotulo={`Remover ${a.codigo}`}
                          titulo={`Remover o ativo ${a.codigo}?`}
                          descricao="O ativo sai da sua lista e das corretoras em que estava vinculado."
                          aviso="Se houver trades, backtestes ou estudos com ele, a remoção é bloqueada — o histórico não se perde por acidente."
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <FormularioAtivo ativo={emEdicao} />
      </div>
    </>
  );
}
