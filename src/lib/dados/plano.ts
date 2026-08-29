import "server-only";

import type { Ativo, Moeda } from "@/lib/ativos";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { Conta } from "@/lib/tipos";

const n = (v: unknown) => Number(v ?? 0);

export type Plano = {
  id: string;
  janela_inicio: string | null;
  janela_fim: string | null;
  min_trades: number | null;
  max_trades: number | null;
  max_loss_seguidos: number | null;
  ativos: Ativo[];
  regras: string[];
  checklist_abertura: string[];
  checklist_fechamento: string[];
  nota_rodape: string | null;
  revisado_em: string | null;
};

export type SetupDoPlano = {
  id: string;
  nome: string;
  plano_evento: string | null;
  plano_adicao: string | null;
  plano_localizacao: string | null;
  plano_stop: string | null;
  plano_realizacao: string | null;
  plano_gestao_stop: string | null;
  backtestes: number;
  assertividade: number | null;
};

export const CAMPOS_DE_EXECUCAO = [
  ["plano_evento", "Evento / gatilho"],
  ["plano_adicao", "Adição"],
  ["plano_localizacao", "Localização"],
  ["plano_stop", "Stop inicial"],
  ["plano_realizacao", "Realização de lucros"],
  ["plano_gestao_stop", "Gestão de stop"],
] as const;

/** Vale a pena mostrar no Plano só o setup que tem alguma linha preenchida. */
const temPlano = (s: SetupDoPlano) =>
  CAMPOS_DE_EXECUCAO.some(([campo]) => Boolean(s[campo]));

export async function carregarPlano(contaId?: string) {
  const supabase = await clienteServidor();

  const [planoResp, setupsResp, contasResp, btResp] = await Promise.all([
    supabase.from("plano").select("*").maybeSingle(),
    supabase.from("setups").select("*").order("ordem"),
    supabase.from("contas").select("*").order("is_padrao", { ascending: false }).order("created_at"),
    supabase.from("backtestes").select("setup_id, resultado"),
  ]);
  if (planoResp.error) throw planoResp.error;
  if (setupsResp.error) throw setupsResp.error;
  if (contasResp.error) throw contasResp.error;
  if (btResp.error) throw btResp.error;

  const plano = planoResp.data as Plano | null;

  const contas = (contasResp.data ?? []).map((c) => ({
    ...c,
    saldo_inicial: n(c.saldo_inicial),
    meta: c.meta === null ? null : n(c.meta),
    mlpt: n(c.mlpt),
    mlpd: n(c.mlpd),
    moeda: (c.moeda ?? "USD") as Moeda,
  })) as Conta[];

  const conta = contas.find((c) => c.id === contaId) ?? contas[0] ?? null;

  const setups = (setupsResp.data ?? []).map((s) => {
    const bt = (btResp.data ?? []).filter((b) => b.setup_id === s.id);
    const gains = bt.filter((b) => b.resultado === "Gain").length;
    const losses = bt.filter((b) => b.resultado === "Loss").length;
    return {
      ...s,
      backtestes: bt.length,
      assertividade: gains + losses === 0 ? null : (gains / (gains + losses)) * 100,
    };
  }) as SetupDoPlano[];

  return {
    plano,
    conta,
    contas,
    setups,
    comPlano: setups.filter(temPlano),
    semPlano: setups.filter((s) => !temPlano(s)),
  };
}
