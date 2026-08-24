import "server-only";

import type { Ativo } from "@/lib/ativos";
import {
  assertividade,
  drawdownDoPico,
  mediaDeGanho,
  mediaDePerda,
  progressoDaMeta,
  riscoRetornoMedio,
  saldoAtual,
  sequenciaAtual,
} from "@/lib/metricas";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { Conta, Lancamento, TempoGrafico } from "@/lib/tipos";

const n = (v: unknown) => Number(v ?? 0);

export type Trade = {
  id: string;
  conta_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  ativo: Ativo;
  tempo_grafico: TempoGrafico;
  setup_id: string;
  pontos_stop: number;
  contratos: number;
  resultado: number;
  risco_retorno: number | null;
  respeitou_plano: boolean;
  imagem_url: string | null;
  observacao: string | null;
  /** Calculados pelo banco — nunca digitados. */
  stop_dolar: number;
  resultado_pontos: number | null;
  status: "Gain" | "Loss" | "Zerado";
};

export type Filtros = { setup?: string; tempo?: string };

/** Ordem cronológica de verdade: data e hora, não created_at. */
const cronologica = (a: Trade, b: Trade) =>
  a.data === b.data ? a.hora_inicio.localeCompare(b.hora_inicio) : a.data.localeCompare(b.data);

export async function contasParaSeletor() {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("contas")
    .select("*")
    .order("is_padrao", { ascending: false })
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    ...c,
    saldo_inicial: n(c.saldo_inicial),
    meta: c.meta === null ? null : n(c.meta),
    mlpt: n(c.mlpt),
    mlpd: n(c.mlpd),
  })) as Conta[];
}

export async function dadosDaPerfomance(conta: Conta, mes: string, filtros: Filtros = {}) {
  const supabase = await clienteServidor();

  const [tradesResp, lancResp, setupsResp] = await Promise.all([
    supabase.from("trades").select("*").eq("conta_id", conta.id),
    supabase.from("lancamentos").select("*").eq("conta_id", conta.id).order("data", { ascending: false }),
    supabase.from("setups").select("id, nome").order("ordem"),
  ]);
  if (tradesResp.error) throw tradesResp.error;
  if (lancResp.error) throw lancResp.error;
  if (setupsResp.error) throw setupsResp.error;

  const trades = (tradesResp.data ?? []).map((t) => ({
    ...t,
    pontos_stop: n(t.pontos_stop),
    resultado: n(t.resultado),
    stop_dolar: n(t.stop_dolar),
    resultado_pontos: t.resultado_pontos === null ? null : n(t.resultado_pontos),
    risco_retorno: t.risco_retorno === null ? null : n(t.risco_retorno),
  })) as Trade[];

  const lancamentos = (lancResp.data ?? []).map((l) => ({
    ...l,
    valor: n(l.valor),
  })) as Lancamento[];

  const setups = (setupsResp.data ?? []) as { id: string; nome: string }[];

  const emOrdem = [...trades].sort(cronologica);
  const resultados = emOrdem.map((t) => t.resultado);
  const saldo = saldoAtual(conta.saldo_inicial, resultados, lancamentos);

  const gains = trades.filter((t) => t.status === "Gain").length;
  const losses = trades.filter((t) => t.status === "Loss").length;

  const doMes = trades.filter((t) => t.data.startsWith(mes));
  const hoje = new Date().toISOString().slice(0, 10);
  const deHoje = trades.filter((t) => t.data === hoje);

  // Filtros valem só para a listagem — os cards falam da conta inteira.
  const listagem = trades
    .filter((t) => (filtros.setup ? t.setup_id === filtros.setup : true))
    .filter((t) => (filtros.tempo ? t.tempo_grafico === filtros.tempo : true))
    .sort((a, b) => -cronologica(a, b));

  return {
    trades,
    listagem,
    lancamentos,
    setups,
    resumo: {
      saldo,
      totalTrades: trades.length,
      assertividade: assertividade(gains, losses),
      riscoRetorno: riscoRetornoMedio(
        trades.filter((t) => t.risco_retorno !== null).map((t) => t.risco_retorno as number),
      ),
      mediaGanho: mediaDeGanho(resultados),
      mediaPerda: mediaDePerda(resultados),
      sequencia: sequenciaAtual(resultados),
      // Lançamento fora: saque não é perda.
      drawdown: drawdownDoPico(conta.saldo_inicial, resultados),
      meta: progressoDaMeta(saldo, conta.saldo_inicial, conta.meta),
      noMes: doMes.reduce((a, t) => a + t.resultado, 0),
      tradesNoMes: doMes.length,
      hoje: {
        resultado: deHoje.reduce((a, t) => a + t.resultado, 0),
        trades: deHoje.length,
      },
      ultimos: emOrdem.slice(-10).map((t) => t.status),
    },
    curva: curvaDeCapital(conta.saldo_inicial, emOrdem, lancamentos),
    porDia: resultadoPorDia(doMes),
  };
}

/**
 * A curva mostra o saldo real, com o degrau do saque. O drawdown é calculado à
 * parte, só sobre operações — ver metricas.ts.
 */
function curvaDeCapital(saldoInicial: number, trades: Trade[], lancamentos: Lancamento[]) {
  type Evento = { data: string; delta: number; tipo: "trade" | "saque" | "aporte" };

  const eventos: Evento[] = [
    ...trades.map((t) => ({ data: t.data, delta: t.resultado, tipo: "trade" as const })),
    ...lancamentos.map((l) => ({
      data: l.data,
      delta: l.tipo === "Aporte" ? l.valor : -l.valor,
      tipo: l.tipo === "Aporte" ? ("aporte" as const) : ("saque" as const),
    })),
  ].sort((a, b) => a.data.localeCompare(b.data));

  let saldo = saldoInicial;
  const pontos: { data: string; saldo: number; tipo: string }[] = [
    { data: trades[0]?.data ?? "", saldo, tipo: "inicio" },
  ];
  for (const e of eventos) {
    saldo += e.delta;
    pontos.push({ data: e.data, saldo, tipo: e.tipo });
  }
  return pontos;
}

function resultadoPorDia(trades: Trade[]) {
  const mapa = new Map<string, { resultado: number; trades: number }>();
  for (const t of trades) {
    const atual = mapa.get(t.data) ?? { resultado: 0, trades: 0 };
    mapa.set(t.data, { resultado: atual.resultado + t.resultado, trades: atual.trades + 1 });
  }
  return mapa;
}
