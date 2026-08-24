import { createClient } from "@supabase/supabase-js";

import { credenciaisSupabase } from "@/lib/supabase/ambiente";

export const dynamic = "force-dynamic";

/**
 * O projeto Supabase Free pausa depois de 7 dias sem uso. Um toque semanal
 * no banco evita ter que reativar na mão no painel.
 *
 * A consulta não lê nada: com RLS ligada e sem sessão, ela volta vazia de
 * qualquer jeito. O que importa é o banco ter recebido a requisição.
 */
export async function GET() {
  try {
    const { url, chave } = credenciaisSupabase();
    const supabase = createClient(url, chave);
    const { error } = await supabase.from("contas").select("id", { head: true, count: "exact" });

    if (error) throw error;
    return Response.json({ ok: true, em: new Date().toISOString() });
  } catch (erro) {
    return Response.json(
      { ok: false, erro: erro instanceof Error ? erro.message : "falha" },
      { status: 500 },
    );
  }
}
