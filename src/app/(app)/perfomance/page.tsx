import Link from "next/link";

import { AvisoDeConstancia } from "@/components/aviso-constancia";
import { BotaoRemover } from "@/components/botao-remover";
import { CalendarioDeConsistencia } from "@/components/calendario";
import { CurvaDeCapital, ResultadoPorOperacao } from "@/components/graficos";
import { contasParaSeletor, dadosDaPerfomance } from "@/lib/dados/trades";
import { data as fData, emR, hora, inteiro, moeda, percentual, VAZIO } from "@/lib/formato";
import { rotuloRiscoRetorno, TEMPOS_GRAFICOS } from "@/lib/opcoes";

import { removerLancamento } from "./acoes";
import { AcoesDoTrade } from "./acoes-trade";
import { FormularioLancamento } from "./formulario-lancamento";
import { FormularioTrade } from "./formulario-trade";
import { SeletorConta, SeletorMes } from "./seletores";

export const metadata = { title: "Perfomance — AION" };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default async function PaginaPerfomance({ searchParams }: PageProps<"/perfomance">) {
  const contas = await contasParaSeletor();

  if (contas.length === 0) {
    return (
      <>
        <h1 className="display mb-5 text-[30px] leading-[1.05]">Perfomance</h1>
        <div className="rounded-xl border border-dashed border-line-strong bg-card/50 p-12 text-center">
          <p className="text-[15px] text-ink-2">Cadastre uma conta antes.</p>
          <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-ink-4">
            Tudo aqui é sempre de uma conta por vez — o saldo, a meta, o drawdown.
          </p>
          <Link href="/conta" className="mt-4 inline-block text-[14px]">Ir para Conta →</Link>
        </div>
      </>
    );
  }

  const params = await searchParams;
  const conta = contas.find((c) => c.id === params.conta) ?? contas[0];
  const mes = typeof params.mes === "string" ? params.mes : new Date().toISOString().slice(0, 7);
  const filtros = {
    setup: typeof params.setup === "string" && params.setup ? params.setup : undefined,
    tempo: typeof params.tempo === "string" && params.tempo ? params.tempo : undefined,
  };

  const { listagem, lancamentos, setups, resumo, curva, porDia } = await dadosDaPerfomance(conta, mes, filtros);
  const [ano, mesNum] = mes.split("-").map(Number);
  const lucro = resumo.saldo - conta.saldo_inicial;

  return (
    <>
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="display text-[30px] leading-[1.05]">Perfomance</h1>
          <p className="mt-2 text-[14px] text-ink-3">
            {resumo.totalTrades === 0
              ? "Nenhum trade registrado nesta conta"
              : `${inteiro(resumo.totalTrades)} trades registrados`}
          </p>
        </div>
        <div className="flex gap-2.5">
          <SeletorConta contas={contas} atual={conta.id} mes={mes} />
          <SeletorMes mes={mes} contaId={conta.id} />
          <FormularioLancamento contaId={conta.id} moedaConta={conta.moeda} />
          <FormularioTrade contaId={conta.id} setups={setups} moedaConta={conta.moeda} />
        </div>
      </header>

      <AvisoDeConstancia />

      {/* HERO */}
      <div className="mb-3 grid grid-cols-4 gap-3">
        <div className="col-span-2 rounded-xl border border-line bg-card px-[22px] py-[18px]">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3">Saldo atual</p>
          <p className={`num mt-2.5 text-[40px] font-semibold leading-none tracking-[-0.035em] ${lucro > 0 ? "text-gain" : lucro < 0 ? "text-loss" : ""}`}>
            {moeda(resumo.saldo, conta.moeda)}
          </p>
          <p className="mt-3 flex items-center gap-2.5">
            <span className={`inline-flex h-[23px] items-center rounded-md px-[9px] text-[13px] font-semibold ${resumo.noMes >= 0 ? "bg-gain-bg text-gain" : "bg-loss-bg text-loss"}`}>
              {moeda(resumo.noMes, conta.moeda, true)}
            </span>
            <span className="text-[13.5px] text-ink-3">
              em {MESES[mesNum - 1]}
              {resumo.tradesNoMes > 0 && ` · ${resumo.tradesNoMes} trades`}
            </span>
          </p>
        </div>

        <Cartao titulo="Meta para saque" destaque>
          {resumo.meta === null ? (
            <p className="num mt-2.5 text-[27px] font-semibold text-ink-4">{VAZIO}</p>
          ) : (
            <>
              <p className="mt-2.5 flex items-baseline gap-2">
                <span className="num text-[27px] font-semibold tracking-[-0.03em] text-accent-soft">
                  {moeda(resumo.meta.falta, conta.moeda)}
                </span>
                <span className="text-[14px] text-ink-2">para liberar</span>
              </p>
              <Barra percentual={resumo.meta.percentual} cor="bg-accent" />
              <div className="mt-2 flex justify-between text-[12px] text-ink-4">
                <span className="num">{moeda(resumo.meta.lucro, conta.moeda, true)} de {moeda(conta.meta, conta.moeda)}</span>
                <span className="num">{percentual(Math.max(0, resumo.meta.percentual))}</span>
              </div>
            </>
          )}
        </Cartao>

        <Cartao titulo="Drawdown do pico">
          <p className={`num mt-2.5 text-[27px] font-semibold tracking-[-0.03em] ${resumo.drawdown.atual > 0 ? "text-loss" : "text-ink-2"}`}>
            {resumo.drawdown.atual > 0 ? `-${moeda(resumo.drawdown.atual, conta.moeda)}` : moeda(0, conta.moeda)}
          </p>
          <p className="mt-3 text-[12.5px] text-ink-4">
            máximo já visto: <span className="num text-ink-3">{moeda(resumo.drawdown.maximo, conta.moeda)}</span>
          </p>
          <p className="mt-1.5 text-[12px] text-ink-4">saque e aporte ficam de fora</p>
        </Cartao>
      </div>

      {/* TILES */}
      <div className="mb-5 grid grid-cols-5 gap-3">
        <Tile titulo="Trades" valor={inteiro(resumo.totalTrades)} extra={`${resumo.tradesNoMes} no mês`} />
        <Tile titulo="Assertividade" valor={percentual(resumo.assertividade)}>
          {resumo.assertividade !== null && (
            <span className="mt-2.5 flex h-[5px] gap-0.5">
              <span className="rounded-[3px] bg-gain" style={{ width: `${resumo.assertividade}%` }} />
              <span className="flex-1 rounded-[3px] bg-loss opacity-60" />
            </span>
          )}
        </Tile>
        <Tile
          titulo="Risco retorno médio"
          valor={emR(resumo.riscoRetorno)}
          cor={resumo.riscoRetorno === null ? "" : resumo.riscoRetorno >= 0 ? "text-gain" : "text-loss"}
        />
        <div className="rounded-xl border border-line bg-card px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3">Ganho / perda médios</p>
          <p className="mt-2.5 flex items-baseline gap-2.5">
            <span className="num text-[22px] font-semibold tracking-[-0.03em] text-gain">{moeda(resumo.mediaGanho, conta.moeda, true)}</span>
            <span className="text-ink-4">/</span>
            <span className="num text-[22px] font-semibold tracking-[-0.03em] text-loss">{moeda(resumo.mediaPerda, conta.moeda)}</span>
          </p>
        </div>
        <div className="rounded-xl border border-line bg-card px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3">Sequência</p>
          {resumo.sequencia ? (
            <>
              <p className="mt-2.5 flex items-baseline gap-2">
                <span className={`num text-[26px] font-semibold tracking-[-0.03em] ${resumo.sequencia.tipo === "Gain" ? "text-gain" : resumo.sequencia.tipo === "Loss" ? "text-loss" : "text-ink-3"}`}>
                  {resumo.sequencia.quantidade}
                </span>
                <span className="text-[13.5px] text-ink-2">
                  {resumo.sequencia.tipo === "Zerado" ? "zerado" : `${resumo.sequencia.tipo.toLowerCase()}s seguidos`}
                </span>
              </p>
              <span className="mt-3 flex gap-[3px]">
                {resumo.ultimos.map((s, i) => (
                  <span
                    key={i}
                    className={`h-4 flex-1 rounded-[3px] ${s === "Gain" ? "bg-gain" : s === "Loss" ? "bg-loss" : "bg-neutral"}`}
                    style={{ opacity: i < resumo.ultimos.length - resumo.sequencia!.quantidade ? 0.5 : 1 }}
                  />
                ))}
              </span>
            </>
          ) : (
            <p className="num mt-2.5 text-[26px] font-semibold text-ink-4">{VAZIO}</p>
          )}
        </div>
      </div>

      {/* CALENDÁRIO + CURVA */}
      <div className="mb-3 grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-3">
        <section className="rounded-xl border border-line bg-card p-[22px]">
          <div className="mb-4">
            <h2 className="display text-[19px]">Calendário de consistência</h2>
            <p className="mt-1.5 text-[13px] text-ink-4">
              {MESES[mesNum - 1]} de {ano} · só dias úteis
            </p>
          </div>
          <CalendarioDeConsistencia mes={mes} porDia={porDia} moedaConta={conta.moeda} />
        </section>

        <section className="flex flex-col rounded-xl border border-line bg-card p-[22px]">
          <div className="mb-4">
            <h2 className="display text-[19px]">Evolução da conta</h2>
            <p className="mt-1.5 text-[13px] text-ink-4">Saldo acumulado desde a abertura</p>
          </div>
          <div className="flex-1 rounded-[10px] border border-line-soft bg-well p-3">
            <CurvaDeCapital pontos={curva.pontos} marcadores={curva.marcadores} meta={conta.meta} moedaConta={conta.moeda} />
          </div>
        </section>
      </div>

      {/* BARRAS */}
      <section className="mb-5 rounded-xl border border-line bg-card p-[22px]">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h2 className="display text-[19px]">Resultado por operação</h2>
            <p className="mt-1.5 text-[13px] text-ink-4">Cada barra é um trade, em ordem</p>
          </div>
          <p className="flex items-center gap-2 text-[12.5px] text-ink-3">
            <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="var(--ref)" strokeWidth="1.5" strokeDasharray="3 3" /></svg>
            MLPT {moeda(conta.mlpt, conta.moeda)}
          </p>
        </div>
        <div className="rounded-[10px] border border-line-soft bg-well p-3">
          <ResultadoPorOperacao
            trades={[...listagem].reverse().map((t) => ({ resultado: t.resultado, data: fData(t.data) }))}
            mlpt={conta.mlpt}
            moedaConta={conta.moeda}
            largura={1120}
          />
        </div>
      </section>

      {/* TABELA */}
      <section className="mb-5 overflow-hidden rounded-xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="display text-[20px]">Trades</h2>
          <Filtros contaId={conta.id} mes={mes} setups={setups} atual={filtros} />
        </div>

        {listagem.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-ink-4">
            {resumo.totalTrades === 0 ? "Nenhum trade ainda." : "Nenhum trade com esses filtros."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 1400 }}>
              <thead>
                <tr>
                  {["Data", "Entrada", "Saída", "Ativo", "TG", "Setup", "Contratos", "Stop pts", "Stop $", "Resultado", "Pontos", "R:R", "Plano", "Status", ""].map((t, i) => (
                    <th
                      key={t + i}
                      scope="col"
                      className={`whitespace-nowrap border-b border-line-strong bg-table-head px-[13px] py-3 text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-2 ${[6, 7, 8, 9, 10, 11].includes(i) ? "text-right" : "text-left"}`}
                    >
                      {[8, 10, 13].includes(i) ? <>{t} <Calc /></> : t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listagem.map((t) => {
                  const td = "whitespace-nowrap border-b border-line-soft bg-table-row px-[13px] py-[11px] text-[14.5px] text-ink-2";
                  const setup = setups.find((s) => s.id === t.setup_id)?.nome ?? VAZIO;
                  return (
                    <tr key={t.id}>
                      <td className={`${td} num`}>{fData(t.data)}</td>
                      <td className={`${td} num`}>{hora(t.hora_inicio)}</td>
                      <td className={`${td} num`}>{hora(t.hora_fim)}</td>
                      <td className={`${td} num font-semibold`}>{t.ativo}</td>
                      <td className={`${td} num`}>{t.tempo_grafico}</td>
                      <td className={td}>{setup}</td>
                      <td className={`${td} num text-right`}>{t.contratos}</td>
                      <td className={`${td} num text-right`}>{String(t.pontos_stop).replace(".", ",")}</td>
                      <td className={`${td} num text-right text-ink-3`}>{moeda(t.stop_dolar, conta.moeda)}</td>
                      <td className={`${td} num text-right font-semibold ${t.resultado > 0 ? "text-gain" : t.resultado < 0 ? "text-loss" : "text-ink-3"}`}>
                        {moeda(t.resultado, conta.moeda, true)}
                      </td>
                      <td className={`${td} num text-right text-ink-3`}>
                        {t.resultado_pontos === null ? VAZIO : t.resultado_pontos.toFixed(2).replace(".", ",")}
                      </td>
                      <td className={`${td} num text-right font-semibold ${(t.risco_retorno ?? 0) >= 0 ? "" : "text-loss"}`}>
                        {rotuloRiscoRetorno(t.risco_retorno)}
                      </td>
                      <td className={td}>
                        <Selo ok={t.respeitou_plano}>{t.respeitou_plano ? "Sim" : "Não"}</Selo>
                      </td>
                      <td className={td}>
                        <span className={`inline-flex h-[23px] items-center rounded-md px-[9px] text-[13px] font-semibold ${t.status === "Gain" ? "bg-gain-bg text-gain" : t.status === "Loss" ? "bg-loss-bg text-loss" : "bg-track text-ink-3"}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className={td}>
                        <AcoesDoTrade
                          trade={{ ...t, imagem: null }}
                          contaId={conta.id}
                          setups={setups}
                          moedaConta={conta.moeda}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="flex items-center gap-2 border-t border-line px-5 py-3.5 text-[13px] text-ink-4">
          <Calc /> calculado pelo app — não se digita
        </p>
      </section>

      {lancamentos.length > 0 && (
        <section className="rounded-xl border border-line bg-card p-[22px]">
          <h2 className="display mb-4 text-[19px]">Saques e aportes</h2>
          <ul className="flex flex-col gap-2">
            {lancamentos.map((l) => (
              <li key={l.id} className="flex items-center gap-4 rounded-[10px] border border-line-soft bg-well px-4 py-3">
                <span className={`inline-flex h-[23px] items-center rounded-md px-[9px] text-[13px] font-semibold ${l.tipo === "Aporte" ? "bg-gain-bg text-gain" : "bg-track text-ink-2"}`}>
                  {l.tipo}
                </span>
                <span className="num text-[14px] text-ink-3">{fData(l.data)}</span>
                <span className={`num text-[16px] font-semibold ${l.tipo === "Aporte" ? "text-gain" : "text-ink"}`}>
                  {l.tipo === "Aporte" ? moeda(l.valor, conta.moeda, true) : `-${moeda(l.valor, conta.moeda)}`}
                </span>
                {l.observacao && <span className="text-[13.5px] text-ink-4">{l.observacao}</span>}
                <span className="ml-auto">
                  <BotaoRemover
                    acao={removerLancamento}
                    campos={{ id: l.id }}
                    rotulo={`Remover ${l.tipo.toLowerCase()} de ${fData(l.data)}`}
                    titulo={`Remover este ${l.tipo.toLowerCase()}?`}
                    descricao="O saldo da conta volta a contar como se ele não tivesse acontecido."
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Calc() {
  return <span className="inline-block size-[5px] rounded-full bg-accent-soft align-super" aria-label="calculado" />;
}

function Selo({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-[23px] items-center rounded-md px-[9px] text-[13px] font-semibold ${ok ? "bg-gain-bg text-gain" : "bg-loss-bg text-loss"}`}>
      {children}
    </span>
  );
}

function Cartao({ titulo, destaque, children }: { titulo: string; destaque?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border bg-card px-5 py-[18px] ${destaque ? "border-accent/45" : "border-line"}`}>
      <p className={`text-[11.5px] font-semibold uppercase tracking-[0.10em] ${destaque ? "text-accent-soft" : "text-ink-3"}`}>{titulo}</p>
      {children}
    </div>
  );
}

function Tile({ titulo, valor, extra, cor = "", children }: { titulo: string; valor: string; extra?: string; cor?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-card px-5 py-4">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3">{titulo}</p>
      <p className="mt-2.5 flex items-baseline gap-2.5">
        <span className={`num text-[26px] font-semibold tracking-[-0.03em] ${cor}`}>{valor}</span>
        {extra && <span className="text-[13px] text-ink-4">{extra}</span>}
      </p>
      {children}
    </div>
  );
}

function Barra({ percentual, cor }: { percentual: number; cor: string }) {
  return (
    <span className="mt-3.5 block h-[6px] overflow-hidden rounded-[3px] bg-track">
      <span className={`block h-full rounded-[3px] ${cor}`} style={{ width: `${Math.max(0, Math.min(100, percentual))}%` }} />
    </span>
  );
}

function Filtros({
  contaId,
  mes,
  setups,
  atual,
}: {
  contaId: string;
  mes: string;
  setups: { id: string; nome: string }[];
  atual: { setup?: string; tempo?: string };
}) {
  const estilo = (ativo: boolean) =>
    `h-[34px] rounded-lg border bg-raised px-3 text-[14px] outline-none ${ativo ? "border-accent text-accent-soft" : "border-line-strong text-ink-2"}`;

  return (
    <form action="/perfomance" className="flex gap-2">
      <input type="hidden" name="conta" value={contaId} />
      <input type="hidden" name="mes" value={mes} />
      <label htmlFor="f-setup" className="sr-only">Setup</label>
      <select id="f-setup" name="setup" defaultValue={atual.setup ?? ""} className={estilo(Boolean(atual.setup))}>
        <option value="">Todos os setups</option>
        {setups.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
      </select>
      <label htmlFor="f-tempo" className="sr-only">Tempo gráfico</label>
      <select id="f-tempo" name="tempo" defaultValue={atual.tempo ?? ""} className={estilo(Boolean(atual.tempo))}>
        <option value="">Todos os tempos</option>
        {TEMPOS_GRAFICOS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <button type="submit" className="h-[34px] rounded-lg border border-line-strong bg-raised px-3.5 text-[14px] font-medium text-ink-2">
        Filtrar
      </button>
    </form>
  );
}
