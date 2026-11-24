"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { BotaoRemover } from "@/components/botao-remover";
import type { Moeda } from "@/lib/ativos";
import type { AtivoCadastrado } from "@/lib/dados/ativos";
import type { CorretoraCadastrada } from "@/lib/dados/corretoras";

import { criarCorretora, editarCorretora, removerCorretora, type EstadoCorretora } from "./acoes";

const INICIAL: EstadoCorretora = {};

const rotulo = "mb-[9px] block text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3";
const campo =
  "h-[42px] w-full rounded-[9px] border border-line-strong bg-input px-[13px] text-[15px] text-ink outline-none placeholder:text-ink-4 focus:border-accent";
const grupo = "flex gap-1 rounded-[9px] border border-line-strong bg-input p-[3px]";
const opcao =
  "block cursor-pointer rounded-md py-[7px] text-center text-[14.5px] font-medium text-ink-3 peer-checked:bg-raised peer-checked:text-ink";
const selo =
  "inline-flex h-[23px] items-center rounded-md bg-raised px-[9px] text-[12.5px] font-semibold text-ink-3";

function SeletorMoeda({ valor, aoMudar }: { valor: Moeda; aoMudar: (m: Moeda) => void }) {
  return (
    <div className={grupo}>
      {(["USD", "BRL"] as const).map((m) => (
        <label key={m} className="flex-1">
          <input type="radio" name="moeda" value={m} checked={valor === m} onChange={() => aoMudar(m)} className="peer sr-only" />
          <span className={opcao}>{m === "USD" ? "Dólar" : "Real"}</span>
        </label>
      ))}
    </div>
  );
}

export function FormularioNovaCorretora({ ativos }: { ativos: AtivoCadastrado[] }) {
  const [estado, acao, enviando] = useActionState(criarCorretora, INICIAL);
  // Controlados: um erro do servidor dispara o reset nativo do <form action>
  // e o campo voltaria em branco (mesmo cuidado da Perfomance).
  const [nome, setNome] = useState("");
  const [moeda, setMoeda] = useState<Moeda>("USD");
  const [marcados, setMarcados] = useState<string[]>(() => ativos.map((a) => a.codigo));

  useEffect(() => {
    if (estado.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa o formulário só depois da Server Action confirmar
      setNome("");
    }
  }, [estado]);

  function alternar(codigo: string) {
    setMarcados((atuais) => (atuais.includes(codigo) ? atuais.filter((c) => c !== codigo) : [...atuais, codigo]));
  }

  return (
    <form
      action={acao}
      autoComplete="off"
      className="w-[352px] shrink-0 med:w-full rounded-xl border border-line bg-card p-[22px]"
    >
      <h2 className="display mb-[22px] text-[19px]">Nova corretora</h2>

      <div className="flex flex-col gap-[17px]">
        <div>
          <label className={rotulo} htmlFor="nome-corretora">Nome</label>
          <input
            id="nome-corretora"
            name="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={40}
            placeholder="Ylos"
            className={campo}
          />
        </div>

        <fieldset>
          <legend className={rotulo}>Moeda da corretora</legend>
          <SeletorMoeda valor={moeda} aoMudar={setMoeda} />
          <p className="mt-2 text-[12px] leading-relaxed text-ink-4">
            É a moeda dos valores dos ativos e das contas desta corretora.
          </p>
        </fieldset>

        <fieldset>
          <legend className={rotulo}>Ativos que ela cobre</legend>
          {ativos.length === 0 ? (
            <p className="text-[13.5px] text-ink-3">
              Você ainda não tem ativos. <Link href="/conta/ativos" className="text-accent-soft">Cadastre em Ativos</Link>{" "}
              e volte aqui.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {ativos.map((a) => (
                  <label key={a.id}>
                    <input
                      type="checkbox"
                      name="ativos"
                      value={a.codigo}
                      checked={marcados.includes(a.codigo)}
                      onChange={() => alternar(a.codigo)}
                      className="peer sr-only"
                    />
                    <span className="num block cursor-pointer rounded-lg border border-line-strong bg-raised px-[13px] py-[8px] text-[14px] font-semibold text-ink-3 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink">
                      {a.codigo}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-4">
                Cada ativo marcado entra com o padrão dele — depois você ajusta o que for diferente
                nesta corretora.
              </p>
            </>
          )}
        </fieldset>

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
          {enviando ? "Criando…" : "Criar corretora"}
        </button>
      </div>
    </form>
  );
}

/** Nome + moeda da corretora, com Editar inline e Remover. */
export function CabecalhoCorretora({ corretora }: { corretora: CorretoraCadastrada }) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, enviando] = useActionState(editarCorretora, INICIAL);
  const [nome, setNome] = useState<string>(corretora.nome);
  const [moeda, setMoeda] = useState<Moeda>(corretora.moeda);

  useEffect(() => {
    if (estado.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha a edição só depois da Server Action confirmar
      setEditando(false);
    }
  }, [estado]);

  if (!editando) {
    return (
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-[11px]">
          <h2 className="display text-[19px]">{corretora.nome}</h2>
          <span className={selo}>{corretora.moeda}</span>
          <span className="text-[13px] text-ink-4">
            {corretora.contas === 0
              ? "sem contas"
              : `${corretora.contas} ${corretora.contas === 1 ? "conta" : "contas"}`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-ink-4">
          <button
            type="button"
            onClick={() => setEditando(true)}
            aria-label={`Editar ${corretora.nome}`}
            className="text-[13px] font-medium text-accent-soft hover:underline"
          >
            Editar
          </button>
          <BotaoRemover
            acao={removerCorretora}
            campos={{ id: corretora.id }}
            rotulo={`Remover ${corretora.nome}`}
            titulo={`Remover a corretora ${corretora.nome}?`}
            descricao="A corretora e os valores dos ativos vinculados a ela saem da sua lista."
            aviso="Se houver contas nela, a remoção é bloqueada — os trades continuam com o valor que tinham."
          />
        </div>
      </div>
    );
  }

  return (
    <form action={acao} autoComplete="off" className="mb-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={corretora.id} />
      <div className="min-w-[180px] flex-1">
        <label className={rotulo} htmlFor={`nome-${corretora.id}`}>Nome</label>
        <input
          id={`nome-${corretora.id}`}
          name="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={40}
          className={campo}
        />
      </div>
      <div className="w-[200px]">
        <span className={rotulo}>Moeda</span>
        <SeletorMoeda valor={moeda} aoMudar={setMoeda} />
      </div>
      <div className="flex items-center gap-3 pb-2.5">
        <button type="button" onClick={() => setEditando(false)} className="text-[13px] text-ink-4 hover:text-ink-2">
          Cancelar
        </button>
        <button type="submit" disabled={enviando} className="text-[13px] font-semibold text-accent-soft disabled:opacity-60">
          {enviando ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {corretora.contas > 0 && (
        <p className="basis-full text-[12px] text-ink-4">
          Esta corretora tem contas: o nome pode mudar, mas a moeda só muda se nenhuma conta a usar.
        </p>
      )}
      {estado.erro && (
        <p role="alert" className="basis-full rounded-[9px] border border-loss/40 bg-loss-bg px-3 py-2 text-[13px] text-loss">
          {estado.erro}
        </p>
      )}
    </form>
  );
}
