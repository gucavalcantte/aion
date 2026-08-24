"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { Conta } from "@/lib/tipos";

import { salvarConta, type EstadoConta } from "./acoes";

const INICIAL: EstadoConta = {};

const rotulo = "mb-[9px] block text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3";
const campo =
  "h-[42px] w-full rounded-[9px] border border-line-strong bg-input px-[13px] text-[15px] text-ink outline-none placeholder:text-ink-4 focus:border-accent";

export function FormularioConta({ conta }: { conta: Conta | null }) {
  const [estado, acao, enviando] = useActionState(salvarConta, INICIAL);
  const editando = Boolean(conta);

  return (
    <form
      action={acao}
      key={conta?.id ?? "nova"}
      className="w-[352px] shrink-0 rounded-xl border border-line bg-card p-[22px]"
    >
      <input type="hidden" name="id" defaultValue={conta?.id ?? ""} />

      <div className="mb-[22px] flex items-center justify-between">
        <h2 className="display text-[19px]">{editando ? "Editar conta" : "Nova conta"}</h2>
        {editando && (
          <Link href="/conta" className="text-[13.5px]">
            Cancelar
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-[17px]">
        <div>
          <label className={rotulo} htmlFor="numero">Número da conta</label>
          <input id="numero" name="numero" defaultValue={conta?.numero ?? ""} placeholder="512-4471" className={`${campo} num`} />
        </div>

        <fieldset>
          <legend className={rotulo}>Tipo de conta</legend>
          <div className="flex gap-1 rounded-[9px] border border-line-strong bg-input p-[3px]">
            {(["Remunerada", "Simulador"] as const).map((t) => (
              <label key={t} className="flex-1">
                <input
                  type="radio"
                  name="tipo_conta"
                  value={t}
                  defaultChecked={(conta?.tipo_conta ?? "Remunerada") === t}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-md py-[7px] text-center text-[14.5px] font-medium text-ink-3 peer-checked:bg-raised peer-checked:text-ink">
                  {t}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className={rotulo} htmlFor="saldo_inicial">Saldo inicial (USD)</label>
          <input id="saldo_inicial" name="saldo_inicial" inputMode="decimal" defaultValue={conta ? String(conta.saldo_inicial) : ""} placeholder="50000,00" className={`${campo} num`} />
          <p className="mt-2 text-[12px] leading-relaxed text-ink-4">
            O saldo atual não é digitado — é sempre saldo inicial + trades − saques + aportes.
          </p>
        </div>

        <div>
          <label className={`${rotulo} !text-accent-soft`} htmlFor="meta">Meta para saque (USD)</label>
          <input id="meta" name="meta" inputMode="decimal" defaultValue={conta?.meta != null ? String(conta.meta) : ""} placeholder="deixe vazio se não tem meta" className={`${campo} num border-accent/50`} />
          <p className="mt-2 text-[12px] leading-relaxed text-ink-4">
            Lucro acumulado necessário para liberar o saque.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="mlpt">MLPT (USD)</label>
            <input id="mlpt" name="mlpt" inputMode="decimal" defaultValue={conta ? String(conta.mlpt) : ""} placeholder="150" className={`${campo} num`} />
          </div>
          <div>
            <label className={rotulo} htmlFor="mlpd">MLPD (USD)</label>
            <input id="mlpd" name="mlpd" inputMode="decimal" defaultValue={conta ? String(conta.mlpd) : ""} placeholder="300" className={`${campo} num`} />
          </div>
        </div>
        <p className="-mt-3 text-[12px] leading-relaxed text-ink-4">
          Perda máxima por trade e por dia. São as duas linhas que o Plano usa como regra.
        </p>

        <label className="flex cursor-pointer items-center gap-[10px] text-[14.5px] text-ink-2">
          <input
            type="checkbox"
            name="is_padrao"
            defaultChecked={conta?.is_padrao ?? false}
            className="size-[18px] appearance-none rounded-[5px] border border-line-strong bg-input checked:border-accent checked:bg-accent checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222.6%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M3 8.4l3.2 3.2L13 4.8%22/></svg>')] checked:bg-center checked:bg-no-repeat"
          />
          Usar como conta padrão
        </label>

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
          {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Criar conta"}
        </button>
      </div>
    </form>
  );
}
