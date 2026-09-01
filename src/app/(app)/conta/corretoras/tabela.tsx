"use client";

import { useActionState, useEffect, useState } from "react";

import { UNIDADES } from "@/lib/opcoes";

import { atualizarEspecificacao, type EstadoEspecificacao } from "./acoes";

const INICIAL: EstadoEspecificacao = {};

const celula =
  "h-[36px] w-full rounded-[7px] border border-line-strong bg-input px-[10px] text-[14px] text-ink outline-none focus:border-accent";

export function TabelaCorretoras({
  corretora,
  ativos,
}: {
  corretora: string;
  ativos: { ativo: string; valorPonto: number; unidade: string }[];
}) {
  return (
    <table className="w-full border-separate border-spacing-0">
      <thead>
        <tr className="text-left text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          <th className="pb-2 pr-3">Ativo</th>
          <th className="pb-2 pr-3">Valor por ponto</th>
          <th className="pb-2 pr-3">Unidade</th>
          <th className="pb-2" />
        </tr>
      </thead>
      <tbody>
        {ativos.map((a) => (
          <LinhaAtivo key={a.ativo} corretora={corretora} {...a} />
        ))}
      </tbody>
    </table>
  );
}

function LinhaAtivo({
  corretora,
  ativo,
  valorPonto,
  unidade,
}: {
  corretora: string;
  ativo: string;
  valorPonto: number;
  unidade: string;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, enviando] = useActionState(atualizarEspecificacao, INICIAL);
  const formId = `form-${corretora}-${ativo}`;

  useEffect(() => {
    if (estado.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha a edição só depois da Server Action confirmar
      setEditando(false);
    }
  }, [estado]);

  if (!editando) {
    return (
      <tr className="border-t border-line-soft">
        <td className="num py-2 pr-3 font-semibold">{ativo}</td>
        <td className="num py-2 pr-3">{String(valorPonto).replace(".", ",")}</td>
        <td className="py-2 pr-3 text-ink-3">{unidade}</td>
        <td className="py-2 text-right">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="text-[13px] font-medium text-accent-soft hover:underline"
          >
            Editar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-t border-line-soft">
        <td className="num py-2 pr-3 font-semibold">{ativo}</td>
        <td className="py-2 pr-3">
          <form id={formId} action={acao} className="contents">
            <input type="hidden" name="corretora" value={corretora} />
            <input type="hidden" name="ativo" value={ativo} />
            <input
              name="valor_ponto"
              form={formId}
              inputMode="decimal"
              defaultValue={String(valorPonto)}
              className={`${celula} num`}
            />
          </form>
        </td>
        <td className="py-2 pr-3">
          <select name="unidade" form={formId} defaultValue={unidade} className={celula}>
            {UNIDADES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </td>
        <td className="py-2 text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="text-[13px] text-ink-4 hover:text-ink-2"
            >
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
      {estado.erro && (
        <tr>
          <td colSpan={4} className="pb-2 pt-1 text-[12.5px] text-loss">{estado.erro}</td>
        </tr>
      )}
    </>
  );
}
