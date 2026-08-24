import { moeda } from "@/lib/formato";

/**
 * O mês em grade de dias úteis. Cada dia tingido pelo resultado — perda ←
 * neutro → ganho. Só dias úteis: futuro americano não abre no fim de semana,
 * e duas colunas mortas por semana só afastariam os dias que interessam.
 */
export function CalendarioDeConsistencia({
  mes,
  porDia,
}: {
  /** "2026-08" */
  mes: string;
  porDia: Map<string, { resultado: number; trades: number }>;
}) {
  const [ano, mesNum] = mes.split("-").map(Number);
  const ultimoDia = new Date(ano, mesNum, 0).getDate();
  const hoje = new Date().toISOString().slice(0, 10);

  const dias: { dia: number; iso: string; semana: number }[] = [];
  for (let d = 1; d <= ultimoDia; d++) {
    const semana = new Date(ano, mesNum - 1, d).getDay();
    if (semana === 0 || semana === 6) continue;
    dias.push({ dia: d, iso: `${mes}-${String(d).padStart(2, "0")}`, semana });
  }

  // A primeira semana começa no dia da semana certo, não na segunda-feira.
  const vaziosIniciais = dias.length > 0 ? dias[0].semana - 1 : 0;

  const resultados = [...porDia.values()].map((v) => Math.abs(v.resultado));
  const maior = Math.max(...resultados, 1);

  const positivos = [...porDia.values()].filter((v) => v.resultado > 0).length;
  const comOperacao = porDia.size;
  const total = [...porDia.values()].reduce((a, v) => a + v.resultado, 0);

  return (
    <div>
      <div className="mb-2 grid grid-cols-5 gap-[7px]">
        {["Seg", "Ter", "Qua", "Qui", "Sex"].map((d) => (
          <span key={d} className="text-center text-[10.5px] font-semibold uppercase tracking-[0.10em] text-ink-3">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-[7px]">
        {Array.from({ length: vaziosIniciais }, (_, i) => <span key={`v${i}`} />)}

        {dias.map(({ dia, iso }) => {
          const registro = porDia.get(iso);
          const futuro = iso > hoje;
          const intensidade = registro ? Math.min(0.42, 0.07 + (Math.abs(registro.resultado) / maior) * 0.35) : 0;

          const fundo = registro
            ? registro.resultado > 0
              ? `color-mix(in srgb, var(--gain) ${intensidade * 100}%, transparent)`
              : registro.resultado < 0
                ? `color-mix(in srgb, var(--loss) ${intensidade * 100}%, transparent)`
                : "var(--well)"
            : futuro
              ? "transparent"
              : "var(--well)";

          return (
            <div
              key={iso}
              style={{ background: fundo }}
              className={
                "flex h-[62px] flex-col justify-between rounded-lg border p-[7px] px-[9px] " +
                (iso === hoje ? "border-accent" : futuro ? "border-dashed border-line-soft" : "border-line-soft")
              }
            >
              <span className="num text-[12px] text-ink-4">{String(dia).padStart(2, "0")}</span>
              {registro ? (
                <span
                  className={
                    "num text-[15px] font-semibold " +
                    (registro.resultado > 0 ? "text-gain" : registro.resultado < 0 ? "text-loss" : "text-ink-3")
                  }
                >
                  {registro.resultado === 0 ? "$0" : moeda(registro.resultado, true).replace(",00", "")}
                </span>
              ) : (
                <span className="text-[12px] text-ink-4">{iso === hoje ? "hoje" : ""}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-[18px] border-t border-line-soft pt-[15px] text-[12.5px] text-ink-4">
        <span className="flex items-center gap-[7px]">
          <span className="size-[13px] rounded-[3px]" style={{ background: "color-mix(in srgb, var(--loss) 45%, transparent)" }} />
          <span className="size-[13px] rounded-[3px] bg-well" />
          <span className="size-[13px] rounded-[3px]" style={{ background: "color-mix(in srgb, var(--gain) 45%, transparent)" }} />
          perda → ganho
        </span>
        <span className="ml-auto">
          <span className="num text-ink-2">{positivos}</span> dias positivos de{" "}
          <span className="num text-ink-2">{comOperacao}</span>
          {comOperacao > 0 && (
            <>
              {" · "}
              <span className={`num ${total >= 0 ? "text-gain" : "text-loss"}`}>{moeda(total, true)}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
