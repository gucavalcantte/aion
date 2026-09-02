"use client";

/**
 * Sem o auto-submit no onChange, trocar o mês só muda a aparência do
 * <input> — o botão de enviar fica escondido (sr-only) e nada é enviado.
 */
export function SeletorMes({ mes }: { mes: string }) {
  return (
    <form action="/estudos" className="flex">
      <label htmlFor="mes" className="sr-only">Mês</label>
      <input
        id="mes"
        name="mes"
        type="month"
        defaultValue={mes}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="num h-[38px] rounded-lg border border-line-strong bg-raised px-[13px] text-[14.5px] text-ink-2 outline-none"
      />
      <button type="submit" className="sr-only">Trocar mês</button>
    </form>
  );
}
