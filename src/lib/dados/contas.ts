import "server-only";

import type { Corretora, Moeda } from "@/lib/ativos";
import { progressoDaMeta, saldoAtual } from "@/lib/metricas";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { Conta, ContaComSaldo } from "@/lib/tipos";

/** PostgREST devolve numeric como número, mas não custa garantir. */
const n = (v: unknown) => Number(v ?? 0);

export async function listarContas(): Promise<ContaComSaldo[]> {
  const supabase = await clienteServidor();

  // Três consultas simples em vez de uma view: o volume é de dezenas de linhas,
  // e assim a conta do saldo fica em metricas.ts, testável fora do banco.
  const [contas, trades, lancamentos] = await Promise.all([
    supabase.from("contas").select("*").order("is_padrao", { ascending: false }).order("created_at"),
    supabase.from("trades").select("conta_id, resultado"),
    supabase.from("lancamentos").select("conta_id, tipo, valor"),
  ]);

  if (contas.error) throw contas.error;
  if (trades.error) throw trades.error;
  if (lancamentos.error) throw lancamentos.error;

  return (contas.data as Conta[]).map((conta) => {
    const resultados = (trades.data ?? [])
      .filter((t) => t.conta_id === conta.id)
      .map((t) => n(t.resultado));

    const movimentos = (lancamentos.data ?? [])
      .filter((l) => l.conta_id === conta.id)
      .map((l) => ({ tipo: l.tipo as "Saque" | "Aporte", valor: n(l.valor) }));

    const saldo = saldoAtual(n(conta.saldo_inicial), resultados, movimentos);

    return {
      ...conta,
      saldo_inicial: n(conta.saldo_inicial),
      meta: conta.meta === null ? null : n(conta.meta),
      mlpt: n(conta.mlpt),
      mlpd: n(conta.mlpd),
      moeda: (conta.moeda ?? "USD") as Moeda,
      corretora: (conta.corretora ?? "Ylos") as Corretora,
      saldo_atual: saldo,
      trades: resultados.length,
      progresso: progressoDaMeta(saldo, n(conta.saldo_inicial), conta.meta === null ? null : n(conta.meta)),
    };
  });
}

export type ContaPadraoBackteste = { mlpt: number | null; corretora: Corretora | null };

/** MLPT e corretora da conta padrão (ou da primeira cadastrada, na falta de uma padrão). */
export async function contaPadraoParaBackteste(): Promise<ContaPadraoBackteste> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("contas")
    .select("mlpt, corretora")
    .order("is_padrao", { ascending: false })
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { mlpt: null, corretora: null };
  return { mlpt: n(data.mlpt), corretora: (data.corretora ?? "Ylos") as Corretora };
}

export async function buscarConta(id: string): Promise<Conta | null> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.from("contas").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, moeda: (data.moeda ?? "USD") as Moeda, corretora: (data.corretora ?? "Ylos") as Corretora } as Conta;
}
