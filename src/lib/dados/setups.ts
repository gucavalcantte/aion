import "server-only";

import { assertividade, riscoRetornoMedio } from "@/lib/metricas";
import { urlsAssinadas } from "@/lib/storage";
import { clienteServidor } from "@/lib/supabase/servidor";

const n = (v: unknown) => Number(v ?? 0);

export type Setup = {
  id: string;
  nome: string;
  descricao: string | null;
  imagem_url: string | null;
  ordem: number;
  plano_evento: string | null;
  plano_adicao: string | null;
  plano_localizacao: string | null;
  plano_stop: string | null;
  plano_realizacao: string | null;
  plano_gestao_stop: string | null;
};

export type Estatistica = {
  registros: number;
  assertividade: number | null;
  riscoRetorno: number | null;
};

export type SetupComEstatistica = Setup & {
  imagem: string | null;
  backteste: Estatistica;
  real: Estatistica;
  /** Diferença em pontos percentuais entre real e backteste. */
  delta: number | null;
};

export async function listarSetups(): Promise<SetupComEstatistica[]> {
  const supabase = await clienteServidor();

  const [setups, backtestes, trades] = await Promise.all([
    supabase.from("setups").select("*").order("ordem").order("created_at"),
    supabase.from("backtestes").select("setup_id, resultado, risco_retorno"),
    supabase.from("trades").select("setup_id, status, risco_retorno"),
  ]);

  if (setups.error) throw setups.error;
  if (backtestes.error) throw backtestes.error;
  if (trades.error) throw trades.error;

  const lista = (setups.data ?? []) as Setup[];
  const imagens = await urlsAssinadas(lista.map((s) => s.imagem_url));

  return lista.map((setup) => {
    const bt = (backtestes.data ?? []).filter((b) => b.setup_id === setup.id);
    const tr = (trades.data ?? []).filter((t) => t.setup_id === setup.id);

    const backteste: Estatistica = {
      registros: bt.length,
      assertividade: assertividade(
        bt.filter((b) => b.resultado === "Gain").length,
        bt.filter((b) => b.resultado === "Loss").length,
      ),
      riscoRetorno: riscoRetornoMedio(bt.map((b) => n(b.risco_retorno))),
    };

    // Zerado fica fora do denominador — por isso filtramos Gain e Loss, não o resto.
    const real: Estatistica = {
      registros: tr.length,
      assertividade: assertividade(
        tr.filter((t) => t.status === "Gain").length,
        tr.filter((t) => t.status === "Loss").length,
      ),
      riscoRetorno: riscoRetornoMedio(
        tr.filter((t) => t.risco_retorno !== null).map((t) => n(t.risco_retorno)),
      ),
    };

    const delta =
      backteste.assertividade !== null && real.assertividade !== null
        ? real.assertividade - backteste.assertividade
        : null;

    return { ...setup, imagem: imagens.get(setup.imagem_url ?? "") ?? null, backteste, real, delta };
  });
}

export async function buscarSetup(id: string) {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.from("setups").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const setup = data as Setup;
  return { ...setup, imagem: await urlsAssinadas([setup.imagem_url]).then((m) => m.get(setup.imagem_url ?? "") ?? null) };
}

/** Nomes dos setups para dropdowns. */
export async function listarSetupsSimples() {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.from("setups").select("id, nome").order("ordem");
  if (error) throw error;
  return (data ?? []) as { id: string; nome: string }[];
}
