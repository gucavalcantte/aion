"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { QuadroTick } from "@/components/quadro-tick";
import type { Moeda } from "@/lib/ativos";
import type { AtivoCadastrado } from "@/lib/dados/ativos";
import { UNIDADES } from "@/lib/opcoes";

import { salvarAtivo, type EstadoAtivo } from "./acoes";

const INICIAL: EstadoAtivo = {};

const rotulo = "mb-[9px] block text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3";
const campo =
  "h-[42px] w-full rounded-[9px] border border-line-strong bg-input px-[13px] text-[15px] text-ink outline-none placeholder:text-ink-4 focus:border-accent";
const grupo = "flex gap-1 rounded-[9px] border border-line-strong bg-input p-[3px]";
const opcao =
  "block cursor-pointer rounded-md py-[7px] text-center text-[14.5px] font-medium text-ink-3 peer-checked:bg-raised peer-checked:text-ink";

/** 0.1 → "0,1": o campo mostra o número como o usuário digitaria. */
const comoTexto = (n: number) => String(n).replace(".", ",");

/**
 * O estado dos campos nasce da prop `ativo`. O `key` é o que faz o formulário
 * recomeçar quando muda o ativo em edição: o Next não remonta a página só porque
 * o `?editar=` mudou, então sem ele o React manteria o estado anterior e o
 * formulário mostraria os valores de outro ativo (ou vazios) com o `id` do clicado.
 */
export function FormularioAtivo({ ativo }: { ativo: AtivoCadastrado | null }) {
  return <CorpoDoFormulario key={ativo?.id ?? "novo"} ativo={ativo} />;
}

function CorpoDoFormulario({ ativo }: { ativo: AtivoCadastrado | null }) {
  const [estado, acao, enviando] = useActionState(salvarAtivo, INICIAL);
  const editando = Boolean(ativo);

  // Controlados: um erro do servidor dispara o reset nativo do <form action>,
  // e sem value+onChange o campo voltaria em branco (mesmo cuidado da Perfomance).
  const [codigo, setCodigo] = useState(ativo?.codigo ?? "");
  const [nome, setNome] = useState(ativo?.nome ?? "");
  const [moeda, setMoeda] = useState<Moeda>(ativo?.moeda ?? "USD");
  const [tamanhoTick, setTamanhoTick] = useState(ativo ? comoTexto(ativo.tamanhoTick) : "");
  const [valorTick, setValorTick] = useState(ativo ? comoTexto(ativo.valorTick) : "");
  const [unidade, setUnidade] = useState<string>(ativo?.unidade ?? "pontos");

  // Cadastro novo concluído: o formulário volta vazio em vez de ficar com o ativo recém-criado.
  // (Edição concluída redireciona para a lista e o `key` do invólucro já remonta tudo.)
  useEffect(() => {
    if (!estado.ok) return;
    /* eslint-disable react-hooks/set-state-in-effect -- limpa só depois da Server Action confirmar */
    setCodigo("");
    setNome("");
    setTamanhoTick("");
    setValorTick("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [estado]);

  return (
    <form
      action={acao}
      autoComplete="off"
      className="w-[352px] shrink-0 med:w-full rounded-xl border border-line bg-card p-[22px]"
    >
      <input type="hidden" name="id" defaultValue={ativo?.id ?? ""} />

      <div className="mb-[22px] flex items-center justify-between">
        <h2 className="display text-[19px]">{editando ? "Editar ativo" : "Novo ativo"}</h2>
        {editando && (
          <Link href="/conta/ativos" className="text-[13.5px]">
            Cancelar
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-[17px]">
        <div className="grid grid-cols-[110px_1fr] gap-3 cel:grid-cols-1">
          <div>
            <label className={rotulo} htmlFor="codigo">Código</label>
            <input
              id="codigo"
              name="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="MES"
              maxLength={10}
              className={`${campo} num uppercase`}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="nome">Nome</label>
            <input id="nome" name="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="S&P" className={campo} />
          </div>
        </div>

        <fieldset>
          <legend className={rotulo}>Moeda dos valores padrão</legend>
          <div className={grupo}>
            {(["USD", "BRL"] as const).map((m) => (
              <label key={m} className="flex-1">
                <input type="radio" name="moeda" value={m} checked={moeda === m} onChange={() => setMoeda(m)} className="peer sr-only" />
                <span className={opcao}>{m === "USD" ? "Dólar" : "Real"}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3 cel:grid-cols-1">
          <div>
            <label className={rotulo} htmlFor="tamanho_tick">Tamanho do tick</label>
            <input
              id="tamanho_tick"
              name="tamanho_tick"
              inputMode="decimal"
              value={tamanhoTick}
              onChange={(e) => setTamanhoTick(e.target.value)}
              placeholder="0,25"
              className={`${campo} num`}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="valor_tick">Valor do tick</label>
            <input
              id="valor_tick"
              name="valor_tick"
              inputMode="decimal"
              value={valorTick}
              onChange={(e) => setValorTick(e.target.value)}
              placeholder="1,25"
              className={`${campo} num`}
            />
          </div>
        </div>
        <p className="-mt-3 text-[12px] leading-relaxed text-ink-4">
          O tick é o menor movimento do preço. Informe quanto ele mede e quanto vale em dinheiro —
          o valor do ponto é calculado.
        </p>

        <fieldset>
          <legend className={rotulo}>Unidade do stop</legend>
          <div className={grupo}>
            {UNIDADES.map((u) => (
              <label key={u} className="flex-1">
                <input type="radio" name="unidade" value={u} checked={unidade === u} onChange={() => setUnidade(u)} className="peer sr-only" />
                <span className={opcao}>{u}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <QuadroTick tamanhoTick={tamanhoTick} valorTick={valorTick} unidade={unidade} moeda={moeda} />

        <p className="text-[12px] leading-relaxed text-ink-4">
          Este é o padrão do ativo. Corretoras já vinculadas não mudam quando você o edita — ajuste
          cada uma em Corretoras.
        </p>

        {estado.erro && (
          <p role="alert" className="rounded-[9px] border border-loss/40 bg-loss-bg px-3 py-2.5 text-[13.5px] text-loss">
            {estado.erro}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="h-10 rounded-[9px] bg-accent text-[14.5px] font-semibold text-accent-ink disabled:opacity-60"
        >
          {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Criar ativo"}
        </button>
      </div>
    </form>
  );
}
