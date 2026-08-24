import "server-only";

import { urlsAssinadas } from "@/lib/storage";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { Estudo } from "@/lib/tipos";

export type EstudoComImagem = Estudo & { imagem: string | null };

export async function estudosDoMes(mes: string) {
  const supabase = await clienteServidor();

  const { data, error } = await supabase
    .from("estudos")
    .select("*")
    .gte("data", `${mes}-01`)
    .lte("data", `${mes}-31`)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const estudos = (data ?? []) as Estudo[];
  const imagens = await urlsAssinadas(estudos.map((e) => e.imagem_url));

  const comImagem: EstudoComImagem[] = estudos.map((e) => ({
    ...e,
    imagem: imagens.get(e.imagem_url ?? "") ?? null,
  }));

  const porDia = new Map<string, EstudoComImagem[]>();
  for (const e of comImagem) {
    const lista = porDia.get(e.data) ?? [];
    lista.push(e);
    porDia.set(e.data, lista);
  }

  return { estudos: comImagem, porDia };
}

export async function buscarEstudo(id: string) {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.from("estudos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const estudo = data as Estudo;
  const imagens = await urlsAssinadas([estudo.imagem_url]);
  return { ...estudo, imagem: imagens.get(estudo.imagem_url ?? "") ?? null };
}
