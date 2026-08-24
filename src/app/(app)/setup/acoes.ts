"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { enviarImagem, removerImagem } from "@/lib/storage";
import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoSetup = { erro?: string };

const texto = (d: FormData, campo: string) => {
  const v = String(d.get(campo) ?? "").trim();
  return v === "" ? null : v;
};

export async function salvarSetup(
  _anterior: EstadoSetup,
  dados: FormData,
): Promise<EstadoSetup> {
  const id = String(dados.get("id") ?? "").trim();
  const nome = texto(dados, "nome");
  if (!nome) return { erro: "Informe o nome do setup." };

  const supabase = await clienteServidor();

  const campos: Record<string, unknown> = {
    nome,
    descricao: texto(dados, "descricao"),
    plano_evento: texto(dados, "plano_evento"),
    plano_adicao: texto(dados, "plano_adicao"),
    plano_localizacao: texto(dados, "plano_localizacao"),
    plano_stop: texto(dados, "plano_stop"),
    plano_realizacao: texto(dados, "plano_realizacao"),
    plano_gestao_stop: texto(dados, "plano_gestao_stop"),
  };

  const arquivo = dados.get("imagem");
  const removerAtual = dados.get("remover_imagem") === "1";
  let caminhoAntigo: string | null = null;

  if (id) {
    const { data } = await supabase.from("setups").select("imagem_url").eq("id", id).maybeSingle();
    caminhoAntigo = data?.imagem_url ?? null;
  }

  if (arquivo instanceof File && arquivo.size > 0) {
    const { caminho, erro } = await enviarImagem(arquivo, "setups");
    if (erro) return { erro };
    campos.imagem_url = caminho;
  } else if (removerAtual) {
    campos.imagem_url = null;
  }

  if (id) {
    const { error } = await supabase.from("setups").update(campos).eq("id", id);
    if (error) return { erro: error.message };
  } else {
    // Setup novo entra no fim da lista.
    const { data } = await supabase
      .from("setups")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    campos.ordem = (data?.ordem ?? -1) + 1;

    const { error } = await supabase.from("setups").insert(campos);
    if (error) return { erro: error.message };
  }

  // A imagem antiga só sai depois que o registro já aponta para a nova.
  if (campos.imagem_url !== undefined && caminhoAntigo && caminhoAntigo !== campos.imagem_url) {
    await removerImagem(caminhoAntigo);
  }

  revalidatePath("/setup");
  redirect("/setup");
}

export async function removerSetup(dados: FormData) {
  const id = String(dados.get("id") ?? "");
  if (!id) return;

  const supabase = await clienteServidor();
  const { data } = await supabase.from("setups").select("imagem_url").eq("id", id).maybeSingle();
  const { error } = await supabase.from("setups").delete().eq("id", id);

  // O banco bloqueia apagar setup com backteste ou trade (on delete restrict).
  // Apagar em silêncio levaria o estudo junto.
  if (error) {
    redirect(
      `/setup?erro=${encodeURIComponent(
        "Esse setup tem backtestes ou trades registrados e não pode ser removido.",
      )}`,
    );
  }

  await removerImagem(data?.imagem_url);
  revalidatePath("/setup");
  redirect("/setup");
}

/** Recebe os ids na ordem nova e grava a posição de cada um. */
export async function reordenarSetups(ids: string[]) {
  const supabase = await clienteServidor();
  await Promise.all(
    ids.map((id, indice) => supabase.from("setups").update({ ordem: indice }).eq("id", id)),
  );
  revalidatePath("/setup");
}
