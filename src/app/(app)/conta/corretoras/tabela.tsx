"use client";

import { useActionState, useEffect, useState } from "react";

import { BotaoRemover } from "@/components/botao-remover";
import { QuadroTick } from "@/components/quadro-tick";
import type { AtivoCadastrado } from "@/lib/dados/ativos";
import type { CorretoraCadastrada, VinculoAtivo } from "@/lib/dados/corretoras";
import { moeda } from "@/lib/formato";
import { UNIDADES } from "@/lib/opcoes";

import {
  atualizarEspecificacao,
  desvincularAtivo,
  vincularAtivo,
  voltarAoPadrao,
  type EstadoCorretora,
} from "./acoes";

const INICIAL: EstadoCorretora = {};

const celula =
  "h-[36px] w-full rounded-[7px] border border-line-strong bg-input px-[10px] text-[14px] text-ink outline-none focus:border-accent";

/** 0.1 → "0,1": o campo mostra o número como o usuário digitaria. */
const comoTexto = (n: number) => String(n).replace(".", ",");

const SIMBOLO_NOME = { USD: "US$", BRL: "R$" } as const;

export function TabelaCorretoras({
  corretora,
  todosOsAtivos,
}: {
  corretora: CorretoraCadastrada;
  todosOsAtivos: AtivoCadastrado[];
}) {
  const vinculados = new Set(corretora.vinculos.map((v) => v.ativo));
  const disponiveis = todosOsAtivos.filter((a) => !vinculados.has(a.codigo));

  return (
    <>
      {corretora.vinculos.length === 0 ? (
        <p className="mb-3 text-[13.5px] text-ink-3">
          Nenhum ativo vinculado ainda — sem isso, as contas desta corretora não conseguem registrar trades.
        </p>
      ) : (
        <div className="overflow-x-auto">
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
              {corretora.vinculos.map((v) => (
                <LinhaVinculo key={v.ativo} corretora={corretora} vinculo={v} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {disponiveis.length > 0 && <FormularioVincular corretora={corretora.nome} disponiveis={disponiveis} />}
    </>
  );
}

function LinhaVinculo({ corretora, vinculo }: { corretora: CorretoraCadastrada; vinculo: VinculoAtivo }) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, enviando] = useActionState(atualizarEspecificacao, INICIAL);
  const [tamanhoTick, setTamanhoTick] = useState(comoTexto(vinculo.tamanhoTick));
  const [valorTick, setValorTick] = useState(comoTexto(vinculo.valorTick));
  const [unidade, setUnidade] = useState(vinculo.unidade);
  const formId = `form-${corretora.id}-${vinculo.ativo}`;

  useEffect(() => {
    if (estado.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha a edição só depois da Server Action confirmar
      setEditando(false);
    }
  }, [estado]);

  function abrirEdicao() {
    // Recomeça dos valores salvos (a edição anterior pode ter sido cancelada).
    setTamanhoTick(comoTexto(vinculo.tamanhoTick));
    setValorTick(comoTexto(vinculo.valorTick));
    setUnidade(vinculo.unidade);
    setEditando(true);
  }

  // O padrão do ativo está em outra moeda e o usuário ainda não ajustou nada.
  const avisoMoeda = vinculo.moedaDoPadrao !== corretora.moeda && !vinculo.difereDoPadrao;

  if (!editando) {
    return (
      <>
        <tr className="border-t border-line-soft">
          <td className="py-2 pr-3">
            <span className="num font-semibold">{vinculo.ativo}</span>
            <span className="ml-2 text-[13px] text-ink-3">{vinculo.nome}</span>
          </td>
          <td className="num py-2 pr-3">{comoTexto(vinculo.tamanhoTick)}</td>
          <td className="num py-2 pr-3">{moeda(vinculo.valorTick, corretora.moeda)}</td>
          <td className="num py-2 pr-3 font-semibold text-accent-soft">{moeda(vinculo.valorPonto, corretora.moeda)}</td>
          <td className="py-2 pr-3 text-ink-3">{vinculo.unidade}</td>
          <td className="py-2 text-right">
            <div className="flex items-center justify-end gap-3 whitespace-nowrap">
              <button
                type="button"
                onClick={abrirEdicao}
                className="text-[13px] font-medium text-accent-soft hover:underline"
              >
                Editar
              </button>
              {vinculo.difereDoPadrao && (
                <form action={voltarAoPadrao} className="flex">
                  <input type="hidden" name="corretora" value={corretora.nome} />
                  <input type="hidden" name="ativo" value={vinculo.ativo} />
                  <button type="submit" className="text-[13px] text-ink-3 hover:text-ink hover:underline">
                    Voltar ao padrão
                  </button>
                </form>
              )}
              <BotaoRemover
                acao={desvincularAtivo}
                campos={{ corretora: corretora.nome, ativo: vinculo.ativo }}
                rotulo={`Desvincular ${vinculo.ativo} de ${corretora.nome}`}
                titulo={`Desvincular ${vinculo.ativo} de ${corretora.nome}?`}
                descricao="A corretora deixa de oferecer esse ativo em trades novos."
                aviso="Os trades que você já registrou continuam com o valor que tinham."
              />
            </div>
          </td>
        </tr>
        {avisoMoeda && (
          <tr>
            <td colSpan={6} className="pb-2 text-[12.5px] text-ink-3">
              Os valores padrão do {vinculo.ativo} estão em {SIMBOLO_NOME[vinculo.moedaDoPadrao]} — confira para{" "}
              {SIMBOLO_NOME[corretora.moeda]}, a moeda desta corretora.
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <>
      <tr className="border-t border-line-soft">
        <td className="py-2 pr-3">
          <span className="num font-semibold">{vinculo.ativo}</span>
          <form id={formId} action={acao} className="contents">
            <input type="hidden" name="corretora" value={corretora.nome} />
            <input type="hidden" name="ativo" value={vinculo.ativo} />
          </form>
        </td>
        <td className="py-2 pr-3">
          <input
            name="tamanho_tick"
            form={formId}
            inputMode="decimal"
            aria-label="Tamanho do tick"
            value={tamanhoTick}
            onChange={(e) => setTamanhoTick(e.target.value)}
            className={`${celula} num`}
          />
        </td>
        <td className="py-2 pr-3">
          <input
            name="valor_tick"
            form={formId}
            inputMode="decimal"
            aria-label="Valor do tick"
            value={valorTick}
            onChange={(e) => setValorTick(e.target.value)}
            className={`${celula} num`}
          />
        </td>
        <td className="py-2 pr-3 text-ink-4">calculado</td>
        <td className="py-2 pr-3">
          <select
            name="unidade"
            form={formId}
            aria-label="Unidade do stop"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            className={celula}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </td>
        <td className="py-2 text-right">
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(false)} className="text-[13px] text-ink-4 hover:text-ink-2">
              Cancelar
            </button>
            <button
              type="submit"
              form={formId}
              disabled={enviando}
              className="text-[13px] font-semibold text-accent-soft disabled:opacity-60"
            >
              {enviando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </td>
      </tr>
      <tr>
        <td colSpan={6} className="pb-3">
          <QuadroTick tamanhoTick={tamanhoTick} valorTick={valorTick} unidade={unidade} moeda={corretora.moeda} />
        </td>
      </tr>
      {estado.erro && (
        <tr>
          <td colSpan={6} className="pb-2 pt-1 text-[12.5px] text-loss">{estado.erro}</td>
        </tr>
      )}
    </>
  );
}

function FormularioVincular({ corretora, disponiveis }: { corretora: string; disponiveis: AtivoCadastrado[] }) {
  const [estado, acao, enviando] = useActionState(vincularAtivo, INICIAL);

  return (
    <form action={acao} className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-line-soft pt-4">
      <input type="hidden" name="corretora" value={corretora} />
      <label htmlFor={`vincular-${corretora}`} className="text-[13px] text-ink-3">Vincular ativo</label>
      <select id={`vincular-${corretora}`} name="ativo" defaultValue={disponiveis[0].codigo} className={`${celula} num w-auto min-w-[150px]`}>
        {disponiveis.map((a) => (
          <option key={a.id} value={a.codigo}>{a.codigo} · {a.nome}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={enviando}
        className="h-[36px] rounded-[7px] border border-line-strong bg-raised px-[14px] text-[13.5px] font-medium text-ink-2 disabled:opacity-60"
      >
        {enviando ? "Vinculando…" : "Vincular"}
      </button>
      {estado.erro && <span role="alert" className="text-[12.5px] text-loss">{estado.erro}</span>}
    </form>
  );
}
