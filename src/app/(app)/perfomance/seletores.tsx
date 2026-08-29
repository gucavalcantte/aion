"use client";

/**
 * Selecionar conta ou mês precisa recarregar a página com o novo filtro na
 * URL. Sem o auto-submit no onChange, trocar a conta só muda a aparência do
 * <select> — o botão de enviar fica escondido (sr-only) e nada é enviado.
 */

export function SeletorConta({
  contas,
  atual,
  mes,
}: {
  contas: { id: string; numero: string; tipo_conta: string }[];
  atual: string;
  mes: string;
}) {
  return (
    <form action="/perfomance" className="flex">
      <input type="hidden" name="mes" value={mes} />
      <label htmlFor="conta" className="sr-only">Conta</label>
      <select
        id="conta"
        name="conta"
        defaultValue={atual}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="num h-[38px] rounded-lg border border-line-strong bg-raised px-[13px] text-[14.5px] font-semibold text-ink-2 outline-none"
      >
        {contas.map((c) => (
          <option key={c.id} value={c.id}>{c.numero} · {c.tipo_conta}</option>
        ))}
      </select>
      <button type="submit" className="sr-only">Trocar conta</button>
    </form>
  );
}

export function SeletorMes({ mes, contaId }: { mes: string; contaId: string }) {
  return (
    <form action="/perfomance" className="flex">
      <input type="hidden" name="conta" value={contaId} />
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
