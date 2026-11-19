import { NextResponse, type NextRequest } from "next/server";

import { urlAssinada } from "@/lib/storage";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Abre o print de um trade em tamanho cheio, em outra aba.
 *
 * O bucket é privado e o link assinado vale 1 hora. Se a aba da Perfomance
 * ficou aberta por mais tempo, o link que ela carrega já morreu — por isso o
 * "abrir em nova aba" passa por aqui e recebe um link novo a cada clique.
 * A policy de trades (RLS) garante que só o dono encontra o trade.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/perfomance/print/[id]">) {
  const { id } = await ctx.params;

  const supabase = await clienteServidor();
  const { data: trade } = await supabase.from("trades").select("imagem_url").eq("id", id).maybeSingle();

  const url = await urlAssinada(trade?.imagem_url);
  if (!url) return new NextResponse("Print não encontrado.", { status: 404 });

  const resposta = NextResponse.redirect(url);
  resposta.headers.set("Cache-Control", "no-store");
  return resposta;
}
