import "server-only";

import { clienteServidor } from "@/lib/supabase/servidor";

/** Dias inteiros entre duas datas ISO, ignorando fuso. */
function diasEntre(de: string, ate: string) {
  const ms = Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Constância é o que o app mede. Trade e estudo contam igual: registrar o
 * print de um dia que você não operou é constância do mesmo jeito.
 */
export async function diasSemRegistro() {
  const supabase = await clienteServidor();

  const [trades, estudos] = await Promise.all([
    supabase.from("trades").select("data").order("data", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("estudos").select("data").order("data", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const datas = [trades.data?.data, estudos.data?.data].filter(Boolean) as string[];
  if (datas.length === 0) return null;

  const ultimo = datas.sort().reverse()[0];
  const hoje = new Date().toISOString().slice(0, 10);

  return { dias: diasEntre(ultimo, hoje), ultimo };
}
