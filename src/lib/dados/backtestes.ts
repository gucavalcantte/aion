import "server-only";

import { assertividade, riscoRetornoMedio } from "@/lib/metricas";
import { TEMPOS_GRAFICOS } from "@/lib/opcoes";
import { clienteServidor } from "@/lib/supabase/servidor";

const n = (v: unknown) => Number(v ?? 0);

export type Backteste = {
  id: string;
  ativo: string;
  data: string;
  periodo: string;
  tempo_grafico: string;
  operacao: string;
  setup_id: string;
  evento: string;
  tamanho_stop: number;
  entrada: string;
  m20: string;
  m200: string;
  alinhamento: string;
  localizacao: string;
  resultado: "Gain" | "Loss";
  risco_retorno: number;
  notas: string | null;
};

export type ResumoTempo = {
  tempo: string;
  registros: number;
  gains: number;
  losses: number;
  assertividade: number | null;
  riscoRetorno: number | null;
};

/** Os sete tempos são fixos: a lista existe mesmo sem nenhum registro. */
export async function resumoPorTempo() {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("backtestes")
    .select("tempo_grafico, resultado, risco_retorno");
  if (error) throw error;

  const linhas = data ?? [];

  const porTempo: ResumoTempo[] = TEMPOS_GRAFICOS.map((tempo) => {
    const doTempo = linhas.filter((l) => l.tempo_grafico === tempo);
    const gains = doTempo.filter((l) => l.resultado === "Gain").length;
    const losses = doTempo.filter((l) => l.resultado === "Loss").length;
    return {
      tempo,
      registros: doTempo.length,
      gains,
      losses,
      assertividade: assertividade(gains, losses),
      riscoRetorno: riscoRetornoMedio(doTempo.map((l) => n(l.risco_retorno))),
    };
  });

  const gains = linhas.filter((l) => l.resultado === "Gain").length;
  const losses = linhas.filter((l) => l.resultado === "Loss").length;

  return {
    porTempo,
    geral: {
      registros: linhas.length,
      assertividade: assertividade(gains, losses),
      riscoRetorno: riscoRetornoMedio(linhas.map((l) => n(l.risco_retorno))),
    },
  };
}

export async function listarBacktestes(tempo: string, setupId?: string) {
  const supabase = await clienteServidor();

  let consulta = supabase
    .from("backtestes")
    .select("*")
    .eq("tempo_grafico", tempo)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  if (setupId) consulta = consulta.eq("setup_id", setupId);

  const { data, error } = await consulta;
  if (error) throw error;

  const linhas = (data ?? []).map((l) => ({
    ...l,
    tamanho_stop: n(l.tamanho_stop),
    risco_retorno: n(l.risco_retorno),
  })) as Backteste[];

  const gains = linhas.filter((l) => l.resultado === "Gain").length;
  const losses = linhas.filter((l) => l.resultado === "Loss").length;

  return {
    linhas,
    resumo: {
      registros: linhas.length,
      assertividade: assertividade(gains, losses),
      riscoRetorno: riscoRetornoMedio(linhas.map((l) => l.risco_retorno)),
    },
  };
}

/** Total do tempo gráfico sem filtro, para o rodapé "N de M". */
export async function totalDoTempo(tempo: string) {
  const supabase = await clienteServidor();
  const { count, error } = await supabase
    .from("backtestes")
    .select("id", { count: "exact", head: true })
    .eq("tempo_grafico", tempo);
  if (error) throw error;
  return count ?? 0;
}
