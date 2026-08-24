import Link from "next/link";

import { AvisoDeConstancia } from "@/components/aviso-constancia";
import { estudosDoMes, type EstudoComImagem } from "@/lib/dados/estudos";
import { inteiro } from "@/lib/formato";

import { FormularioEstudo } from "./formulario";
import { Galeria } from "./galeria";

export const metadata = { title: "Estudos do dia — AION" };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default async function PaginaEstudos({ searchParams }: PageProps<"/estudos">) {
  const params = await searchParams;
  const hoje = new Date().toISOString().slice(0, 10);
  const mes = typeof params.mes === "string" ? params.mes : hoje.slice(0, 7);
  const { estudos, porDia } = await estudosDoMes(mes);

  const diaSelecionado =
    typeof params.dia === "string" && params.dia.startsWith(mes)
      ? params.dia
      : ([...porDia.keys()].sort().reverse()[0] ?? (mes === hoje.slice(0, 7) ? hoje : `${mes}-01`));

  const doDia = porDia.get(diaSelecionado) ?? [];
  const [ano, mesNum] = mes.split("-").map(Number);

  return (
    <>
      <header className="mb-[18px] flex items-end justify-between">
        <div>
          <h1 className="display text-[30px] leading-[1.05]">Estudos do dia</h1>
          <p className="mt-2 text-[14px] text-ink-3">
            Prints do que aconteceu no gráfico — inclusive o que você deixou passar
          </p>
        </div>
        <div className="flex gap-2.5">
          <form action="/estudos" className="flex">
            <label htmlFor="mes" className="sr-only">Mês</label>
            <input
              id="mes"
              name="mes"
              type="month"
              defaultValue={mes}
              className="num h-[38px] rounded-lg border border-line-strong bg-raised px-[13px] text-[14.5px] text-ink-2 outline-none"
            />
            <button type="submit" className="sr-only">Trocar mês</button>
          </form>
          <FormularioEstudo dia={diaSelecionado} />
        </div>
      </header>

      <AvisoDeConstancia />

      <div className="flex items-start gap-3.5">
        <section className="w-[392px] shrink-0 rounded-xl border border-line bg-card p-[22px]">
          <div className="mb-4">
            <h2 className="display text-[19px]">{MESES[mesNum - 1]}</h2>
            <p className="mt-1.5 text-[13px] text-ink-4">
              {estudos.length === 0
                ? "nenhum estudo neste mês"
                : `${inteiro(estudos.length)} ${estudos.length === 1 ? "estudo" : "estudos"} em ${porDia.size} ${porDia.size === 1 ? "dia" : "dias"}`}
            </p>
          </div>
          <Calendario mes={mes} porDia={porDia} selecionado={diaSelecionado} hoje={hoje} />
        </section>

        <section className="min-w-0 flex-1">
          <div className="mb-3.5 flex items-baseline justify-between">
            <h2 className="display text-[19px]">
              {Number(diaSelecionado.slice(8))} de {MESES[mesNum - 1]}
            </h2>
            <p className="text-[13.5px] text-ink-3">
              <span className="num">{doDia.length}</span> {doDia.length === 1 ? "estudo" : "estudos"}
            </p>
          </div>

          {doDia.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong bg-card/50 p-12 text-center">
              <p className="text-[15px] text-ink-2">Nenhum estudo neste dia.</p>
              <p className="mx-auto mt-2 max-w-[460px] text-[13.5px] leading-relaxed text-ink-4">
                Vale registrar até o que deu certo por regra — a entrada que você ignorou
                e o plano estava certo conta tanto quanto a que você perdeu.
              </p>
            </div>
          ) : (
            <Galeria estudos={doDia} />
          )}
        </section>
      </div>
    </>
  );
}

function Calendario({
  mes,
  porDia,
  selecionado,
  hoje,
}: {
  mes: string;
  porDia: Map<string, EstudoComImagem[]>;
  selecionado: string;
  hoje: string;
}) {
  const [ano, mesNum] = mes.split("-").map(Number);
  const ultimoDia = new Date(ano, mesNum, 0).getDate();

  const dias: { dia: number; iso: string; semana: number }[] = [];
  for (let d = 1; d <= ultimoDia; d++) {
    const semana = new Date(ano, mesNum - 1, d).getDay();
    if (semana === 0 || semana === 6) continue;
    dias.push({ dia: d, iso: `${mes}-${String(d).padStart(2, "0")}`, semana });
  }
  const vaziosIniciais = dias.length > 0 ? dias[0].semana - 1 : 0;

  return (
    <>
      <div className="mb-2 grid grid-cols-5 gap-1.5">
        {["Seg", "Ter", "Qua", "Qui", "Sex"].map((d) => (
          <span key={d} className="text-center text-[10px] font-semibold uppercase tracking-[0.10em] text-ink-3">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: vaziosIniciais }, (_, i) => <span key={`v${i}`} />)}

        {dias.map(({ dia, iso }) => {
          const quantos = porDia.get(iso)?.length ?? 0;
          const ativo = iso === selecionado;
          return (
            <Link
              key={iso}
              href={`/estudos?mes=${mes}&dia=${iso}`}
              aria-current={ativo ? "date" : undefined}
              className={
                "flex h-[54px] flex-col justify-between rounded-lg border px-2 py-1.5 transition-colors " +
                (ativo
                  ? "border-accent bg-accent text-accent-ink"
                  : iso > hoje
                    ? "border-dashed border-line-soft bg-well/50"
                    : "border-line-soft bg-well hover:border-line-strong")
              }
            >
              <span className={`num text-[12px] ${ativo ? "text-accent-ink/75" : "text-ink-4"}`}>
                {String(dia).padStart(2, "0")}
              </span>
              {quantos > 0 ? (
                <span className={`num text-[12.5px] font-semibold ${ativo ? "text-accent-ink" : "text-accent-soft"}`}>
                  {quantos}
                </span>
              ) : (
                <span className="text-[11.5px] text-ink-4">{iso === hoje ? "hoje" : ""}</span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-line-soft pt-[15px] text-[12.5px] text-ink-4">
        <span className="flex items-center gap-2">
          <span className="size-[13px] rounded-[3px] bg-accent" />
          dia selecionado
        </span>
        <span className="flex items-center gap-2">
          <span className="num font-semibold text-accent-soft">n</span>
          estudos no dia
        </span>
      </div>
    </>
  );
}
