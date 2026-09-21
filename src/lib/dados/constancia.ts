import "server-only";

import { resumoDeConstancia } from "@/lib/constancia";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Constância é o que o app mede. Trade, estudo e backteste contam igual:
 * registrar o print de um dia que você não operou é constância do mesmo jeito.
 */
export async function diasSemRegistro() {
  const supabase = await clienteServidor();

  const maisRecente = (tabela: "trades" | "estudos" | "backtestes") =>
    supabase.from(tabela).select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();

  const fontes = await Promise.all([maisRecente("trades"), maisRecente("estudos"), maisRecente("backtestes")]);

  return resumoDeConstancia(fontes.map((f) => f.data?.created_at));
}
