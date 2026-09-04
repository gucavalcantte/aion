"use server";

import { revalidatePath } from "next/cache";

import { enviarImagem, removerImagem } from "@/lib/storage";
import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoTrade = { erro?: string; ok?: boolean };

const texto = (d: FormData, campo: string) => {
  const v = String(d.get(campo) ?? "").trim();
  return v === "" ? null : v;
};

function decimal(valor: FormDataEntryValue | null): number | null {
  const t = String(valor ?? "").trim();
  if (!t) return null;
  // Aceita "1.500,50" e "-85.5". O sinal importa: é ele que separa gain de loss.
  const n = Number(t.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function salvarTrade(
  _anterior: EstadoTrade,
  dados: FormData,
): Promise<EstadoTrade> {
  const id = String(dados.get("id") ?? "").trim();

  const obrigatorios: [string, string][] = [
    ["conta_id", "conta"],
    ["data", "data"],
    ["hora_inicio", "hora de entrada"],
    ["hora_fim", "hora de saída"],
    ["ativo", "ativo"],
    ["tempo_grafico", "tempo gráfico"],
    ["setup_id", "setup"],
    // "tipo de entrada" e não "entrada": a mensagem divide espaço com a
    // "hora de entrada" logo acima, e as duas confundem se tiverem o mesmo nome.
    ["entrada", "tipo de entrada"],
  ];
  const faltando = obrigatorios.filter(([campo]) => !texto(dados, campo)).map(([, r]) => r);
  if (faltando.length > 0) {
    return { erro: `Falta preencher: ${faltando.join(", ")}.` };
  }

  const pontos = decimal(dados.get("pontos_stop"));
  const contratos = decimal(dados.get("contratos"));
  const resultado = decimal(dados.get("resultado"));

  if (pontos === null || pontos <= 0) return { erro: "Informe o stop em pontos." };
  if (contratos === null || contratos < 1) return { erro: "Informe a quantidade de contratos." };
  if (resultado === null) return { erro: "Informe o resultado em dólar (use sinal negativo no loss)." };

  const rr = decimal(dados.get("risco_retorno"));

  const campos: Record<string, unknown> = {
    conta_id: texto(dados, "conta_id"),
    data: texto(dados, "data"),
    hora_inicio: texto(dados, "hora_inicio"),
    hora_fim: texto(dados, "hora_fim"),
    ativo: texto(dados, "ativo"),
    tempo_grafico: texto(dados, "tempo_grafico"),
    setup_id: texto(dados, "setup_id"),
    entrada: texto(dados, "entrada"),
    pontos_stop: pontos,
    contratos: Math.round(contratos),
    resultado,
    risco_retorno: rr,
    respeitou_plano: dados.get("respeitou_plano") === "on",
    observacao: texto(dados, "observacao"),
  };

  const supabase = await clienteServidor();

  let caminhoAntigo: string | null = null;
  if (id) {
    const { data } = await supabase.from("trades").select("imagem_url").eq("id", id).maybeSingle();
    caminhoAntigo = data?.imagem_url ?? null;
  }

  const arquivo = dados.get("imagem");
  if (arquivo instanceof File && arquivo.size > 0) {
    const { caminho, erro } = await enviarImagem(arquivo, "trades");
    if (erro) return { erro };
    campos.imagem_url = caminho;
  } else if (dados.get("remover_imagem") === "1") {
    campos.imagem_url = null;
  }

  const { error } = id
    ? await supabase.from("trades").update(campos).eq("id", id)
    : await supabase.from("trades").insert(campos);
  if (error) return { erro: error.message };

  if (campos.imagem_url !== undefined && caminhoAntigo && caminhoAntigo !== campos.imagem_url) {
    await removerImagem(caminhoAntigo);
  }

  revalidatePath("/perfomance");
  revalidatePath("/conta");
  return { ok: true };
}

export async function removerTrade(dados: FormData) {
  const id = String(dados.get("id") ?? "");
  if (!id) return;

  const supabase = await clienteServidor();
  const { data } = await supabase.from("trades").select("imagem_url").eq("id", id).maybeSingle();
  await supabase.from("trades").delete().eq("id", id);
  await removerImagem(data?.imagem_url);

  revalidatePath("/perfomance");
  revalidatePath("/conta");
}

export type EstadoLancamento = { erro?: string; ok?: boolean };

export async function salvarLancamento(
  _anterior: EstadoLancamento,
  dados: FormData,
): Promise<EstadoLancamento> {
  const conta = texto(dados, "conta_id");
  const tipo = String(dados.get("tipo") ?? "");
  const valor = decimal(dados.get("valor"));
  const quando = texto(dados, "data");

  if (!conta) return { erro: "Conta não identificada." };
  if (tipo !== "Saque" && tipo !== "Aporte") return { erro: "Escolha saque ou aporte." };
  if (valor === null || valor <= 0) return { erro: "Informe um valor maior que zero." };
  if (!quando) return { erro: "Informe a data." };

  const supabase = await clienteServidor();
  const { error } = await supabase.from("lancamentos").insert({
    conta_id: conta,
    data: quando,
    tipo,
    valor,
    observacao: texto(dados, "observacao"),
  });
  if (error) return { erro: error.message };

  revalidatePath("/perfomance");
  revalidatePath("/conta");
  return { ok: true };
}

export async function removerLancamento(dados: FormData) {
  const id = String(dados.get("id") ?? "");
  if (!id) return;

  const supabase = await clienteServidor();
  await supabase.from("lancamentos").delete().eq("id", id);

  revalidatePath("/perfomance");
  revalidatePath("/conta");
}
