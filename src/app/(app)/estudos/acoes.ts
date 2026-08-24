"use server";

import { revalidatePath } from "next/cache";

import { enviarImagem, removerImagem } from "@/lib/storage";
import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoEstudo = { erro?: string; ok?: boolean };

const texto = (d: FormData, campo: string) => {
  const v = String(d.get(campo) ?? "").trim();
  return v === "" ? null : v;
};

export async function salvarEstudo(
  _anterior: EstadoEstudo,
  dados: FormData,
): Promise<EstadoEstudo> {
  const id = String(dados.get("id") ?? "").trim();
  const data = texto(dados, "data");
  const ativo = texto(dados, "ativo");
  const tempo = texto(dados, "tempo_grafico");

  if (!data) return { erro: "Informe a data." };
  if (!ativo) return { erro: "Escolha o ativo." };
  if (!tempo) return { erro: "Escolha o tempo gráfico." };

  const supabase = await clienteServidor();

  let caminhoAntigo: string | null = null;
  if (id) {
    const { data: atual } = await supabase.from("estudos").select("imagem_url").eq("id", id).maybeSingle();
    caminhoAntigo = atual?.imagem_url ?? null;
  }

  const campos: Record<string, unknown> = {
    data,
    ativo,
    tempo_grafico: tempo,
    observacao: texto(dados, "observacao"),
  };

  const arquivo = dados.get("imagem");
  if (arquivo instanceof File && arquivo.size > 0) {
    const { caminho, erro } = await enviarImagem(arquivo, "estudos");
    if (erro) return { erro };
    campos.imagem_url = caminho;
  } else if (dados.get("remover_imagem") === "1") {
    campos.imagem_url = null;
  } else if (!id) {
    // O estudo é o print. Sem imagem ele não conta a história de nada.
    return { erro: "Escolha o print do gráfico." };
  }

  const { error } = id
    ? await supabase.from("estudos").update(campos).eq("id", id)
    : await supabase.from("estudos").insert(campos);
  if (error) return { erro: error.message };

  if (campos.imagem_url !== undefined && caminhoAntigo && caminhoAntigo !== campos.imagem_url) {
    await removerImagem(caminhoAntigo);
  }

  revalidatePath("/estudos");
  return { ok: true };
}

export async function removerEstudo(dados: FormData) {
  const id = String(dados.get("id") ?? "");
  if (!id) return;

  const supabase = await clienteServidor();
  const { data } = await supabase.from("estudos").select("imagem_url").eq("id", id).maybeSingle();
  await supabase.from("estudos").delete().eq("id", id);
  await removerImagem(data?.imagem_url);

  revalidatePath("/estudos");
}
