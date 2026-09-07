import Link from "next/link";

import { AvisoDeConstancia } from "@/components/aviso-constancia";
import { BotaoRemover } from "@/components/botao-remover";
import { CalendarioDeConsistencia } from "@/components/calendario";
import { CurvaDeCapital, GaugeRiscoRetorno, ResultadoPorOperacao } from "@/components/graficos";
import { contasParaSeletor, dadosDaPerfomance } from "@/lib/dados/trades";
import { especificacoesDaCorretora } from "@/lib/dados/corretoras";
import { data as fData, emR, inteiro, moeda, percentual, VAZIO } from "@/lib/formato";
import { ENTRADAS, SEM_SETUP, TEMPOS_GRAFICOS } from "@/lib/opcoes";

import { removerLancamento } from "./acoes";
import { FormularioLancamento } from "./formulario-lancamento";
import { FormularioTrade } from "./formulario-trade";
import { SeletorConta, SeletorMes } from "./seletores";
import { TabelaTrades } from "./tabela-trades";

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
    entrada: typeof params.entrada === "string" && params.entrada ? params.entrada : undefined,
  };

  const { listagem, lancamentos, setups, resumo, curva, porDia, execucoesPorTrade, imagensPorTrade, semSetupNoRecorte } =
    await dadosDaPerfomance(conta, mes, filtros);
  const especificacoes = await especificacoesDaCorretora(conta.corretora);
  const [ano, mesNum] = mes.split("-").map(Number);
  const lucro = resumo.saldo - conta.saldo_inicial;

  // Multiplicador da disciplina pode sair < 1 (raro: foi melhor fora do plano).
  // Mostrar sempre o lado maior por cima, com a cor e a frase do lado que venceu.
  const d = resumo.disciplina;
  const pe = resumo.porEntrada;
  const pex = resumo.porExecucoes;
  const comPlanoGanha = d?.multiplicador !== null && d?.multiplicador !== undefined && d.multiplicador >= 1;
  const razaoDisciplina =
    d?.multiplicador === null || d?.multiplicador === undefined
      ? null
      : comPlanoGanha
        ? d.multiplicador
        : 1 / d.multiplicador;

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
          <FormularioTrade contaId={conta.id} setups={setups} moedaConta={conta.moeda} especificacoes={especificacoes} />
        </div>
      </header>

      <AvisoDeConstancia />
      <AvisoDeSemSetup quantidade={semSetupNoRecorte} />

      {/* HERO — R:R médio dos gains e o saldo dividem o topo */}
      <div className="mb-3 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-3">
        <Cartao titulo="R:R médio dos gains">
          <GaugeRiscoRetorno valor={resumo.riscoRetorno} />
          <p className="mt-1 text-center text-[12.5px] text-ink-4">
            quanto o setup paga em média quando o trade dá gain
          </p>
        </Cartao>

        <Cartao titulo="Saldo atual">
          <p className={`num mt-2.5 text-[34px] font-semibold leading-none tracking-[-0.03em] ${lucro > 0 ? "text-gain" : lucro < 0 ? "text-loss" : ""}`}>
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
        </Cartao>
      </div>

      {/* FAIXA — estatísticas secundárias, uma tira só em vez de seis cards
          disputando atenção com o topo. */}
      <div className="mb-5 grid grid-cols-6 divide-x divide-line rounded-xl border border-line bg-card py-4 transition-colors hover:border-line-strong">
        <ItemFaixa titulo="Trades" valor={inteiro(resumo.totalTrades)} extra={`${resumo.tradesNoMes} no mês`} />

        <ItemFaixa titulo="Assertividade" valor={percentual(resumo.assertividade)}>
          {resumo.assertividade !== null && (
            <span className="mt-2 flex h-[4px] gap-0.5">
              <span className="rounded-[2px] bg-gain" style={{ width: `${resumo.assertividade}%` }} />
              <span className="flex-1 rounded-[2px] bg-loss opacity-60" />
            </span>
          )}
        </ItemFaixa>

        <ItemFaixa titulo="Ganho / perda">
          <p className="num mt-2 flex items-baseline gap-1.5 text-[16px] font-semibold">
            <span className="text-gain">{moeda(resumo.mediaGanho, conta.moeda, true)}</span>
            <span className="text-ink-4">/</span>
            <span className="text-loss">{moeda(resumo.mediaPerda, conta.moeda)}</span>
          </p>
        </ItemFaixa>

        <ItemFaixa titulo="Sequência">
          {resumo.sequencia ? (
            <>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className={`num text-[18px] font-semibold ${resumo.sequencia.tipo === "Gain" ? "text-gain" : resumo.sequencia.tipo === "Loss" ? "text-loss" : "text-ink-3"}`}>
                  {resumo.sequencia.quantidade}
                </span>
                <span className="text-[11.5px] text-ink-3">
                  {resumo.sequencia.tipo === "Zerado" ? "zerado" : `${resumo.sequencia.tipo.toLowerCase()}s`}
                </span>
              </p>
              <span className="mt-2 flex gap-[2px]">
                {resumo.ultimos.map((s, i) => (
                  <span
                    key={i}
                    className={`h-[10px] flex-1 rounded-[2px] ${s === "Gain" ? "bg-gain" : s === "Loss" ? "bg-loss" : "bg-neutral"}`}
                    style={{ opacity: i < resumo.ultimos.length - resumo.sequencia!.quantidade ? 0.5 : 1 }}
                  />
                ))}
              </span>
            </>
          ) : (
            <p className="num mt-2 text-[18px] text-ink-4">{VAZIO}</p>
          )}
        </ItemFaixa>

        <ItemFaixa
          titulo="Drawdown do pico"
          valor={resumo.drawdown.atual > 0 ? `-${moeda(resumo.drawdown.atual, conta.moeda)}` : moeda(0, conta.moeda)}
          cor={resumo.drawdown.atual > 0 ? "text-loss" : "text-ink-2"}
          extra={`máx. já visto: ${moeda(resumo.drawdown.maximo, conta.moeda)}`}
        />

        <ItemFaixa titulo="Meta para saque">
          {resumo.meta === null ? (
            <p className="num mt-2 text-[18px] text-ink-4">{VAZIO}</p>
          ) : (
            <>
              <p className="num mt-2 text-[18px] font-semibold text-accent-soft">{moeda(resumo.meta.falta, conta.moeda)}</p>
              <span className="mt-2 block h-[4px] overflow-hidden rounded-[2px] bg-track">
                <span className="block h-full rounded-[2px] bg-accent" style={{ width: `${Math.max(0, Math.min(100, resumo.meta.percentual))}%` }} />
              </span>
              <p className="mt-1 text-[11px] text-ink-4">{percentual(Math.max(0, resumo.meta.percentual))} da meta</p>
            </>
          )}
        </ItemFaixa>
      </div>

      {/* CALENDÁRIO + CURVA */}
      <div className="mb-3 grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-3">
        <section className="rounded-xl border border-line bg-card p-[22px]">
          <div className="mb-4">
            <h2 className="display text-[19px]">Calendário de consistência</h2>
            <p className="mt-1.5 text-[13px] text-ink-4">
              {MESES[mesNum - 1]} de {ano} · <span className="num">{resumo.tradesNoMes}</span> trades · só dias úteis
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

      {/* BARRAS + DISCIPLINA */}
      <div className="mb-5 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
        <section className="rounded-xl border border-line bg-card p-[22px]">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h2 className="display text-[19px]">Resultado por operação</h2>
              <p className="mt-1.5 text-[13px] text-ink-4">
                Cada barra é um trade, em ordem — histórico completo, não só {MESES[mesNum - 1]}
              </p>
            </div>
            <p className="flex items-center gap-2 text-[12.5px] text-ink-3">
              <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="var(--accent-soft)" strokeWidth="1.5" strokeDasharray="3 3" /></svg>
              MLPT {moeda(conta.mlpt, conta.moeda)}
            </p>
          </div>
          <div className="rounded-[10px] border border-line-soft bg-well p-3">
            <ResultadoPorOperacao
              trades={[...listagem].reverse().map((t) => ({ resultado: t.resultado, data: fData(t.data) }))}
              mlpt={conta.mlpt}
              moedaConta={conta.moeda}
              largura={780}
            />
          </div>
        </section>

        <section className="rounded-xl border border-line bg-card p-[22px]">
          <h2 className="display text-[19px]">Disciplina</h2>
          <p className="mt-1.5 text-[13px] text-ink-4">Assertividade conforme você seguiu o plano</p>

          {d === null ? (
            <p className="mt-6 text-[13.5px] text-ink-4">Ainda não há trades suficientes.</p>
          ) : (
            <>
              <p className={`display mt-4 text-[42px] font-extrabold leading-none ${razaoDisciplina === null ? "text-ink-4" : comPlanoGanha ? "text-gain" : "text-loss"}`}>
                {razaoDisciplina === null ? VAZIO : `${razaoDisciplina.toFixed(1).replace(".", ",")}×`}
              </p>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">
                {razaoDisciplina === null ? (
                  "ainda sem trades fora do plano para comparar"
                ) : comPlanoGanha ? (
                  <>
                    mais acerto seguindo o plano
                    {d.semPlano.trades > 0 && (
                      <>
                        {" "}— os <span className="num">{d.semPlano.trades}</span> trades fora dele{" "}
                        {d.resultadoFora <= 0 ? "custaram" : "renderam"}{" "}
                        <span className={`num ${d.resultadoFora <= 0 ? "text-loss" : "text-gain"}`}>
                          {moeda(d.resultadoFora, conta.moeda, true)}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  "mais acerto quando NÃO seguiu o plano — vale revisar se o plano ainda faz sentido"
                )}
              </p>

              <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
                <BarraDeDisciplina rotulo="Respeitou o plano" assertividade={d.comPlano.assertividade} />
                <BarraDeDisciplina rotulo="Não respeitou" assertividade={d.semPlano.assertividade} />
              </div>
            </>
          )}
        </section>
      </div>

      {/* CONFIRMADA x ANTECIPADA */}
      <section className="mb-5 rounded-xl border border-line bg-card p-[22px]">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="display text-[19px]">Confirmada × Antecipada</h2>
            <p className="mt-1.5 text-[13px] text-ink-4">Assertividade e resultado por tipo de entrada</p>
          </div>
          {pe !== null && pe.semRegistro > 0 && (
            <p className="text-[12.5px] text-ink-4">
              <span className="num">{pe.semRegistro}</span>{" "}
              {pe.semRegistro === 1 ? "trade ainda sem tipo" : "trades ainda sem tipo"} — fora da comparação
            </p>
          )}
        </div>

        {pe === null ? (
          <p className="mt-6 text-[13.5px] text-ink-4">
            Nenhum trade tem tipo de entrada ainda. Ele passa a ser pedido nos trades novos; os antigos
            entram aqui conforme você editar cada um.
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {pe.fatias.map((f) => (
              <div key={f.entrada} className="rounded-[10px] border border-line-soft bg-well p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13.5px] font-semibold text-ink-2">{f.entrada}</span>
                  <span className="num text-[12.5px] text-ink-4">
                    {f.trades === 1 ? "1 trade" : `${inteiro(f.trades)} trades`}
                  </span>
                </div>
                <p className={`num mt-3 text-[32px] font-semibold leading-none ${f.assertividade === null ? "text-ink-4" : ""}`}>
                  {percentual(f.assertividade)}
                </p>
                <div className="mt-3 flex h-[6px] gap-0.5">
                  <span className="rounded-[3px] bg-gain" style={{ width: `${f.assertividade ?? 0}%` }} />
                  <span className="flex-1 rounded-[3px] bg-loss opacity-50" />
                </div>
                <p className="mt-3 text-[12.5px] text-ink-3">
                  resultado{" "}
                  <span className={`num font-semibold ${f.trades === 0 ? "" : f.resultado > 0 ? "text-gain" : f.resultado < 0 ? "text-loss" : ""}`}>
                    {f.trades === 0 ? VAZIO : moeda(f.resultado, conta.moeda, true)}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* EXECUÇÕES — parciais e adições */}
      <section className="mb-5 rounded-xl border border-line bg-card p-[22px]">
        <h2 className="display text-[19px]">Execuções (parciais e adições)</h2>
        <p className="mt-1.5 text-[13px] text-ink-4">
          Uso do log de execuções e o efeito no resultado — nada aqui recalcula resultado ou status
        </p>

        {pex === null ? (
          <p className="mt-6 text-[13.5px] text-ink-4">
            Nenhum trade tem execuções registradas ainda. Marque &quot;Teve parciais ou adições&quot; no
            formulário quando isso acontecer.
          </p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-[10px] border border-line-soft bg-well p-4">
                <span className="text-[12.5px] text-ink-3">Trades com execuções</span>
                <p className="num mt-2 text-[26px] font-semibold leading-none">
                  {percentual(pex.percentualComExecucoes)}
                </p>
                <p className="mt-2 text-[12px] text-ink-4">
                  {inteiro(pex.comExecucoes)} de {inteiro(pex.totalTrades)} trades
                </p>
              </div>
              <div className="rounded-[10px] border border-line-soft bg-well p-4">
                <span className="text-[12.5px] text-ink-3">Execuções por trade</span>
                <p className="num mt-2 text-[26px] font-semibold leading-none">
                  {pex.mediaExecucoesPorTrade === null ? VAZIO : pex.mediaExecucoesPorTrade.toFixed(1).replace(".", ",")}
                </p>
                <p className="mt-2 text-[12px] text-ink-4">média, entre os que usam parcial/adição</p>
              </div>
              <div className="rounded-[10px] border border-line-soft bg-well p-4">
                <span className="text-[12.5px] text-ink-3">Adição usada</span>
                <p className="num mt-2 text-[26px] font-semibold leading-none">{percentual(pex.percentualAdicao)}</p>
                <p className="mt-2 text-[12px] text-ink-4">
                  {inteiro(pex.trocasComAdicao)} dos {inteiro(pex.comExecucoes)} trades com execução
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-[10px] border border-line-soft bg-well p-4">
                <p className="text-[13.5px] font-semibold text-ink-2">Distribuição por tipo</p>
                <div className="mt-3 flex h-[26px] overflow-hidden rounded-md">
                  {pex.distribuicao.map((d2, i) => {
                    const total = pex.distribuicao.reduce((a, x) => a + x.quantidade, 0);
                    const cor =
                      d2.tipo === "Parcial" ? "var(--serie-parcial)" : d2.tipo === "Adição" ? "var(--serie-adicao)" : "var(--accent)";
                    return (
                      <div
                        key={d2.tipo}
                        title={`${d2.tipo} — ${inteiro(d2.quantidade)} (${percentual(total === 0 ? null : (d2.quantidade / total) * 100)})`}
                        className="flex items-center justify-center text-[11.5px] font-semibold text-white"
                        style={{
                          width: total === 0 ? 0 : `${(d2.quantidade / total) * 100}%`,
                          background: cor,
                          borderRight: i < pex.distribuicao.length - 1 ? "2px solid var(--well)" : "none",
                        }}
                      >
                        {total > 0 && d2.quantidade / total >= 0.12 ? percentual((d2.quantidade / total) * 100, 0) : ""}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {pex.distribuicao.map((d2) => (
                    <span key={d2.tipo} className="flex items-center gap-1.5 text-[12px] text-ink-3">
                      <span
                        className="inline-block size-[9px] rounded-[2px]"
                        style={{
                          background:
                            d2.tipo === "Parcial" ? "var(--serie-parcial)" : d2.tipo === "Adição" ? "var(--serie-adicao)" : "var(--accent)",
                        }}
                      />
                      {d2.tipo} <span className="num text-ink-4">{inteiro(d2.quantidade)}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[10px] border border-line-soft bg-well p-4">
                <p className="text-[13.5px] font-semibold text-ink-2">Resultado: com × sem execuções</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11.5px] text-ink-4">Assertividade</p>
                    <p className="num mt-1 text-[15px] font-semibold">
                      <span className="text-accent-soft">{percentual(pex.comExecucoesGrupo.assertividade)}</span>
                      <span className="mx-1 text-ink-4">/</span>
                      <span className="text-ink-3">{percentual(pex.semExecucoesGrupo.assertividade)}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11.5px] text-ink-4">R:R médio dos gains</p>
                    <p className="num mt-1 text-[15px] font-semibold">
                      <span className="text-accent-soft">{emR(pex.comExecucoesGrupo.riscoRetorno)}</span>
                      <span className="mx-1 text-ink-4">/</span>
                      <span className="text-ink-3">{emR(pex.semExecucoesGrupo.riscoRetorno)}</span>
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[11.5px] text-ink-4">
                  <span className="text-accent-soft">com execuções</span> ({inteiro(pex.comExecucoesGrupo.trades)}) ·{" "}
                  <span className="text-ink-3">sem execuções</span> ({inteiro(pex.semExecucoesGrupo.trades)})
                </p>
              </div>
            </div>
          </>
        )}
      </section>

      {/* TABELA */}
      <section className="mb-5 overflow-hidden rounded-xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="display text-[20px]">Trades</h2>
          <Filtros contaId={conta.id} mes={mes} setups={setups} atual={filtros} />
        </div>

        <TabelaTrades
          listagem={listagem}
          totalTrades={resumo.totalTrades}
          setups={setups}
          contaId={conta.id}
          moedaConta={conta.moeda}
          especificacoes={especificacoes}
          execucoesPorTrade={execucoesPorTrade}
          imagensPorTrade={imagensPorTrade}
        />
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

/**
 * Lembrete, não alarme — mesmo espírito do AvisoDeConstancia: sem cor de
 * erro, some sozinho quando não há trade sem setup no recorte filtrado.
 */
function AvisoDeSemSetup({ quantidade }: { quantidade: number }) {
  if (quantidade === 0) return null;

  return (
    <div className="mb-5 flex items-center gap-3.5 rounded-[11px] border border-accent/40 bg-accent/10 px-[18px] py-3.5">
      <svg width="19" height="19" viewBox="0 0 16 16" fill="none" stroke="var(--accent-soft)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
        <path d="M8 1.6l6.8 12H1.2z" />
        <path d="M8 6.4V9M8 11.2h.01" />
      </svg>
      <p className="text-[14.5px] text-ink-2">
        <strong className="num text-accent-soft">{quantidade}</strong>{" "}
        {quantidade === 1 ? "trade sem setup" : "trades sem setup"} neste recorte.
      </p>
    </div>
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

/** Um item da tira de estatísticas secundárias — menor que um Cartao de propósito. */
function ItemFaixa({
  titulo,
  valor,
  extra,
  cor = "",
  children,
}: {
  titulo: string;
  valor?: string;
  extra?: string;
  cor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-4 first:pl-5 last:pr-5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">{titulo}</p>
      {valor !== undefined && <p className={`num mt-2 text-[18px] font-semibold ${cor}`}>{valor}</p>}
      {extra && <p className="mt-1 text-[11px] text-ink-4">{extra}</p>}
      {children}
    </div>
  );
}

function BarraDeDisciplina({ rotulo, assertividade }: { rotulo: string; assertividade: number | null }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[12.5px] text-ink-2">
        <span>{rotulo}</span>
        <span className="num">{percentual(assertividade)}</span>
      </div>
      <div className="flex h-[6px] gap-0.5">
        <span className="rounded-[3px] bg-gain" style={{ width: `${assertividade ?? 0}%` }} />
        <span className="flex-1 rounded-[3px] bg-loss opacity-50" />
      </div>
    </div>
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
  atual: { setup?: string; tempo?: string; entrada?: string };
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
        <option value={SEM_SETUP}>Sem setup</option>
        {setups.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
      </select>
      <label htmlFor="f-tempo" className="sr-only">Tempo gráfico</label>
      <select id="f-tempo" name="tempo" defaultValue={atual.tempo ?? ""} className={estilo(Boolean(atual.tempo))}>
        <option value="">Todos os tempos</option>
        {TEMPOS_GRAFICOS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <label htmlFor="f-entrada" className="sr-only">Tipo de entrada</label>
      <select id="f-entrada" name="entrada" defaultValue={atual.entrada ?? ""} className={estilo(Boolean(atual.entrada))}>
        <option value="">Todas as entradas</option>
        {ENTRADAS.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
      <button type="submit" className="h-[34px] rounded-lg border border-line-strong bg-raised px-3.5 text-[14px] font-medium text-ink-2">
        Filtrar
      </button>
    </form>
  );
}
