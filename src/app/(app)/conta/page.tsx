import Link from "next/link";

import { BotaoRemover } from "@/components/botao-remover";

import { buscarConta, listarContas } from "@/lib/dados/contas";
import { moeda, percentual, VAZIO } from "@/lib/formato";
import type { ContaComSaldo } from "@/lib/tipos";

import { removerConta } from "./acoes";
import { FormularioConta } from "./formulario";

export const metadata = { title: "Contas — AION" };

export default async function PaginaConta({
  searchParams,
}: PageProps<"/conta">) {
  const { editar, erro } = await searchParams;
  const contas = await listarContas();
  const emEdicao = typeof editar === "string" ? await buscarConta(editar) : null;

  const prontas = contas.filter((c) => c.progresso && c.progresso.percentual >= 100).length;

  return (
    <>
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="display text-[30px] leading-[1.05]">Contas</h1>
          <p className="mt-2 text-[14px] text-ink-3">
            {contas.length === 0
              ? "Nenhuma conta ainda"
              : `${contas.length} ${contas.length === 1 ? "conta" : "contas"}${prontas > 0 ? ` · ${prontas} pronta${prontas > 1 ? "s" : ""} para saque` : ""}`}
          </p>
        </div>
      </header>

      {typeof erro === "string" && (
        <p role="alert" className="mb-4 rounded-[10px] border border-loss/40 bg-loss-bg px-4 py-3 text-[14px] text-loss">
          {erro}
        </p>
      )}

      <div className="flex items-start gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {contas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong bg-card/50 p-10 text-center">
              <p className="text-[15px] text-ink-2">Cadastre a primeira conta ao lado.</p>
              <p className="mt-2 text-[13.5px] text-ink-4">
                Tudo na Perfomance é de uma conta por vez — ela precisa existir antes.
              </p>
            </div>
          ) : (
            contas.map((conta) => <CartaoConta key={conta.id} conta={conta} />)
          )}
        </div>

        <FormularioConta conta={emEdicao} />
      </div>
    </>
  );
}

function CartaoConta({ conta }: { conta: ContaComSaldo }) {
  const lucro = conta.saldo_atual - conta.saldo_inicial;
  const corSaldo = lucro > 0 ? "text-gain" : lucro < 0 ? "text-loss" : "text-ink-2";

  return (
    <article
      className={
        "rounded-xl border bg-card p-[22px] " +
        (conta.is_padrao ? "border-accent/45" : "border-line")
      }
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-[11px]">
          <span className="num text-[17px] font-semibold">{conta.numero}</span>
          <span className="inline-flex h-[23px] items-center rounded-md bg-raised px-[9px] text-[12.5px] font-semibold text-ink-3">
            {conta.tipo_conta}
          </span>
          {conta.is_padrao && (
            <span className="inline-flex h-[23px] items-center rounded-md bg-accent px-[9px] text-[12.5px] font-semibold text-accent-ink">
              Padrão
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-ink-4">
          <Link href={`/conta?editar=${conta.id}`} aria-label={`Editar conta ${conta.numero}`} className="text-ink-4 hover:text-ink-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.3 2.7a1.6 1.6 0 0 1 2.3 2.3L5.5 13 2 14l1-3.5z" />
            </svg>
          </Link>
          <BotaoRemover
            acao={removerConta}
            campos={{ id: conta.id }}
            rotulo={`Remover conta ${conta.numero}`}
            titulo={`Remover a conta ${conta.numero}?`}
            descricao="A conta sai da lista e deixa de aparecer na Perfomance."
            aviso="Se houver trades registrados nela, o banco bloqueia a remoção — o histórico não se perde por acidente."
          />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-5 gap-4">
        <Metrica titulo="Saldo inicial" valor={moeda(conta.saldo_inicial)} />
        <Metrica titulo="Saldo atual" valor={moeda(conta.saldo_atual)} cor={corSaldo} destaque />
        <Metrica titulo="Meta para saque" valor={conta.meta === null ? VAZIO : moeda(conta.meta)} />
        <Metrica titulo="Risco por trade" valor={moeda(conta.mlpt)} />
        <Metrica titulo="Perda máx. do dia" valor={moeda(conta.mlpd)} />
      </div>

      {conta.progresso && (
        <div className="rounded-[10px] border border-line-soft bg-well p-[17px]">
          <div className="mb-[11px] flex items-baseline justify-between">
            <span className="text-[14px] text-ink-2">Progresso até o saque</span>
            <span>
              <span className={`num text-[16px] font-semibold ${conta.progresso.lucro >= 0 ? "text-accent-soft" : "text-loss"}`}>
                {moeda(conta.progresso.lucro, true)}
              </span>
              <span className="num ml-1.5 text-[13px] text-ink-4">de {moeda(conta.meta)}</span>
            </span>
          </div>
          <div className="h-[7px] overflow-hidden rounded-[4px] bg-track">
            <div
              className="h-full rounded-[4px] bg-accent"
              style={{ width: `${Math.max(0, Math.min(100, conta.progresso.percentual))}%` }}
            />
          </div>
          <div className="mt-[10px] flex justify-between text-[12.5px]">
            {conta.progresso.lucro < 0 ? (
              <span className="num text-ink-3">abaixo do saldo inicial</span>
            ) : (
              <span className="num font-semibold text-accent-soft">
                {percentual(conta.progresso.percentual)} da meta
              </span>
            )}
            <span className="num text-ink-3">faltam {moeda(conta.progresso.falta)}</span>
          </div>
        </div>
      )}
    </article>
  );
}

function Metrica({
  titulo,
  valor,
  cor = "text-ink-2",
  destaque = false,
}: {
  titulo: string;
  valor: string;
  cor?: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className={`text-[10.5px] font-semibold uppercase tracking-[0.10em] ${destaque ? "text-accent-soft" : "text-ink-3"}`}>
        {titulo}
      </span>
      <span className={`num text-[17px] ${destaque ? "font-semibold" : ""} ${cor}`}>{valor}</span>
    </div>
  );
}
