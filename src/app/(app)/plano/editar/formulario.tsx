"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { ATIVOS } from "@/lib/ativos";
import type { Plano } from "@/lib/dados/plano";
import { moeda } from "@/lib/formato";

import { salvarPlano, type EstadoPlano } from "../acoes";
import { ListaEditavel } from "./lista-editavel";

const INICIAL: EstadoPlano = {};

const rotulo = "text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3";
const campo =
  "h-[42px] w-full rounded-[9px] border border-line-strong bg-input px-[13px] text-[15px] text-ink outline-none focus:border-accent";
const AVISO_SAIDA = "Você tem alterações não salvas neste plano. Sair sem salvar?";

export function FormularioPlano({
  plano,
  conta,
}: {
  plano: Plano | null;
  conta: { id: string; numero: string; mlpt: number; mlpd: number } | null;
}) {
  const [estado, acao, enviando] = useActionState(salvarPlano, INICIAL);
  const [sujo, setSujo] = useState(false);

  // Fechar a aba ou recarregar com alterações não salvas também avisa.
  useEffect(() => {
    if (!sujo) return;
    const aoSair = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [sujo]);

  // Qualquer edição de campo ou clique nos botões de lista (adicionar,
  // remover, reordenar) marca o plano como sujo — só a navegação por link
  // precisa ser interceptada, o próprio submit já sai da página.
  function marcarSujo(e: React.SyntheticEvent) {
    if ((e.target as HTMLElement).closest("button[type=button]")) setSujo(true);
  }

  function saindoSemSalvar(e: React.MouseEvent) {
    if (sujo && !window.confirm(AVISO_SAIDA)) e.preventDefault();
  }

  return (
    <form action={acao} onChangeCapture={() => setSujo(true)} onClickCapture={marcarSujo}>
      <header className="mb-[18px] flex items-end justify-between">
        <div>
          <p className="mb-[7px] flex items-center gap-2 text-[14px] text-ink-3">
            <Link href="/plano" onClick={saindoSemSalvar}>Plano</Link>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 3l5 5-5 5" />
            </svg>
            <span className="font-semibold text-ink">Editar</span>
          </p>
          <h1 className="display text-[30px] leading-[1.05]">Pré-mercado</h1>
        </div>
        <div className="flex gap-2.5">
          <Link
            href="/plano"
            onClick={saindoSemSalvar}
            className="flex h-10 items-center rounded-[9px] border border-line-strong bg-raised px-[17px] text-[14.5px] font-medium text-ink-2"
          >
            Cancelar
          </Link>
          <button type="submit" disabled={enviando} className="flex h-10 items-center gap-2 rounded-[9px] bg-accent px-[17px] text-[14.5px] font-semibold text-accent-ink disabled:opacity-60">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 8.4l3.2 3.2L13 4.8" />
            </svg>
            {enviando ? "Salvando…" : "Salvar plano"}
          </button>
        </div>
      </header>

      {estado.erro && (
        <p role="alert" className="mb-4 rounded-[10px] border border-loss/40 bg-loss-bg px-4 py-3 text-[14px] text-loss">
          {estado.erro}
        </p>
      )}

      <div className="grid grid-cols-[392px_minmax(0,1fr)] items-start gap-4">
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-line bg-card p-[22px]">
            <div className="mb-4 flex items-center justify-between">
              <span className={rotulo}>Gerenciamento</span>
              <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md bg-raised px-2.5 text-[11.5px] font-semibold text-ink-3">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4.6 7V5a3.4 3.4 0 0 1 6.8 0v2" />
                  <rect x="3.3" y="7" width="9.4" height="6.4" rx="1.5" />
                </svg>
                SÓ LEITURA
              </span>
            </div>
            <div className="flex flex-col gap-3.5 rounded-[10px] border border-line-soft bg-well p-[17px]">
              <span className="flex items-baseline justify-between">
                <span className="num text-[13.5px] text-ink-3">MLPT · por trade</span>
                <span className="num text-[20px] font-semibold text-loss">
                  {conta ? moeda(conta.mlpt).replace(",00", "") : "—"}
                </span>
              </span>
              <span className="h-px bg-line" />
              <span className="flex items-baseline justify-between">
                <span className="num text-[13.5px] text-ink-3">MLPD · por dia</span>
                <span className="num text-[20px] font-semibold text-loss">
                  {conta ? moeda(conta.mlpd).replace(",00", "") : "—"}
                </span>
              </span>
            </div>
            <p className="mt-3 flex items-center justify-between text-[13px]">
              <span className="text-ink-4">
                {conta ? <>vem da conta <span className="num">{conta.numero}</span></> : "sem conta cadastrada"}
              </span>
              <Link href="/conta">Editar na Conta →</Link>
            </p>
          </section>

          <section className="rounded-xl border border-line bg-card p-[22px]">
            <span className={rotulo}>Janela e limites</span>

            <div className="mt-4">
              <p className="mb-2.5 text-[14px] text-ink-2">Janela operacional</p>
              <div className="flex items-center gap-2.5">
                <input name="janela_inicio" type="time" defaultValue={plano?.janela_inicio?.slice(0, 5) ?? ""} className={`${campo} num flex-1`} />
                <span className="text-[14px] text-ink-4">até</span>
                <input name="janela_fim" type="time" defaultValue={plano?.janela_fim?.slice(0, 5) ?? ""} className={`${campo} num flex-1`} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-2.5 block text-[14px] text-ink-2">Mínimo de trades</span>
                <input name="min_trades" inputMode="numeric" defaultValue={plano?.min_trades ?? ""} className={`${campo} num`} />
              </label>
              <label>
                <span className="mb-2.5 block text-[14px] text-ink-2">Máximo de trades</span>
                <input name="max_trades" inputMode="numeric" defaultValue={plano?.max_trades ?? ""} className={`${campo} num`} />
              </label>
            </div>

            <div className="mt-4">
              <p className="mb-2.5 text-[14px] text-ink-2">Encerrar o dia após</p>
              <div className="flex items-center gap-2.5">
                <input name="max_loss_seguidos" inputMode="numeric" defaultValue={plano?.max_loss_seguidos ?? ""} className={`${campo} num w-[82px]`} />
                <span className="text-[14px] text-ink-4">losses seguidos</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-card p-[22px]">
            <span className={rotulo}>Ativos autorizados</span>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {ATIVOS.map((a) => (
                <label key={a.codigo}>
                  <input
                    type="checkbox"
                    name="ativos"
                    value={a.codigo}
                    defaultChecked={plano?.ativos?.includes(a.codigo)}
                    className="peer sr-only"
                  />
                  <span className="num block cursor-pointer rounded-lg border border-line-strong bg-raised px-[15px] py-[9px] text-[14.5px] font-semibold text-ink-3 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink">
                    {a.codigo}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3.5 text-[12.5px] leading-[1.5] text-ink-4">
              Clique para ligar ou desligar. Ativo desligado continua disponível no cadastro — o
              plano só registra qual você se comprometeu a operar.
            </p>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-line bg-card p-[22px]">
            <span className={`${rotulo} mb-4 block`}>Regras</span>
            <ListaEditavel
              nome="regras"
              inicial={plano?.regras ?? []}
              rotuloAdicionar="Adicionar regra"
              placeholder="uma regra por linha"
            />
            <p className="mt-3.5 text-[12.5px] leading-[1.5] text-ink-4">
              Janela, quantidade de trades e losses seguidos já viram regra sozinhos a partir dos
              campos ao lado — não precisa repetir aqui.
            </p>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <section className="rounded-xl border border-line bg-card p-[22px]">
              <span className={`${rotulo} mb-4 block`}>Checklist de abertura</span>
              <ListaEditavel
                nome="checklist_abertura"
                inicial={plano?.checklist_abertura ?? []}
                rotuloAdicionar="Adicionar item"
              />
            </section>
            <section className="rounded-xl border border-line bg-card p-[22px]">
              <span className={`${rotulo} mb-4 block`}>Checklist de fechamento</span>
              <ListaEditavel
                nome="checklist_fechamento"
                inicial={plano?.checklist_fechamento ?? []}
                rotuloAdicionar="Adicionar item"
              />
            </section>
          </div>

          <section className="rounded-xl border border-line bg-card p-[22px]">
            <span className={`${rotulo} mb-3.5 block`}>Frase de rodapé</span>
            <textarea
              name="nota_rodape"
              rows={3}
              defaultValue={plano?.nota_rodape ?? ""}
              placeholder="Uma boa operação pode dar loss e uma operação ruim pode dar gain. O que se avalia aqui é o processo."
              className="w-full resize-y rounded-[9px] border border-line-strong bg-input px-[15px] py-3 text-[14.5px] leading-[1.6] text-ink-2 outline-none placeholder:text-ink-4 focus:border-accent"
            />
            <p className="mt-2.5 text-[12.5px] text-ink-4">
              Aparece no rodapé da tela e da folha impressa.
            </p>
          </section>

          <section className="flex items-center justify-between rounded-xl border border-line bg-card px-[22px] py-[18px]">
            <div>
              <p className="text-[14.5px] text-ink-2">Execução por setup</p>
              <p className="mt-1.5 text-[13px] text-ink-4">
                Evento, adição, localização, stop, realização e gestão ficam dentro de cada setup.
              </p>
            </div>
            <Link href="/setup" onClick={saindoSemSalvar} className="whitespace-nowrap text-[14px]">Ir para Setups →</Link>
          </section>
        </div>
      </div>
    </form>
  );
}
