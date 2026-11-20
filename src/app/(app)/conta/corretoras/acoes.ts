"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { lerNumero, normalizarNomeCorretora, validarEspecificacao } from "@/lib/contrato";
import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoCorretora = { erro?: string; ok?: boolean };

type ErroBanco = { code?: string; message: string };

/** ON DELETE RESTRICT levanta 23001 (e NO ACTION, 23503): os dois significam "tem registros". */
const emUso = (e: ErroBanco) => e.code === "23001" || e.code === "23503";

function mensagemDeSalvar(e: ErroBanco): string {
  if (e.code === "23505") return "Você já tem uma corretora com esse nome.";
  if (e.message.includes("corretora_com_contas")) return "Essa corretora tem contas — a moeda não pode mudar.";
  return e.message;
}

const moedaValida = (m: string): m is "USD" | "BRL" => m === "USD" || m === "BRL";

function voltarComErro(mensagem: string): never {
  redirect(`/conta/corretoras?erro=${encodeURIComponent(mensagem)}`);
}

export async function criarCorretora(
  _anterior: EstadoCorretora,
  dados: FormData,
): Promise<EstadoCorretora> {
  const nome = normalizarNomeCorretora(String(dados.get("nome") ?? ""));
  const moeda = String(dados.get("moeda") ?? "");
  const ativos = dados.getAll("ativos").map(String);

  if (!nome) return { erro: "Informe o nome da corretora (até 40 caracteres)." };
  if (!moedaValida(moeda)) return { erro: "Escolha a moeda da corretora." };

  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("criar_corretora", {
    p_nome: nome,
    p_moeda: moeda,
    p_ativos: ativos,
  });
  if (error) return { erro: mensagemDeSalvar(error) };

  revalidatePath("/conta/corretoras");
  return { ok: true };
}

export async function editarCorretora(
  _anterior: EstadoCorretora,
  dados: FormData,
): Promise<EstadoCorretora> {
  const id = String(dados.get("id") ?? "");
  const nome = normalizarNomeCorretora(String(dados.get("nome") ?? ""));
  const moeda = String(dados.get("moeda") ?? "");

  if (!id) return { erro: "Dados inválidos." };
  if (!nome) return { erro: "Informe o nome da corretora (até 40 caracteres)." };
  if (!moedaValida(moeda)) return { erro: "Escolha a moeda da corretora." };

  const supabase = await clienteServidor();
  const { error } = await supabase.from("corretoras").update({ nome, moeda }).eq("id", id);
  if (error) return { erro: mensagemDeSalvar(error) };

  revalidatePath("/conta/corretoras");
  revalidatePath("/conta");
  return { ok: true };
}

export async function removerCorretora(dados: FormData) {
  const id = String(dados.get("id") ?? "");
  if (!id) return;

  const supabase = await clienteServidor();
  const { error } = await supabase.from("corretoras").delete().eq("id", id);
  if (error) {
    voltarComErro(
      emUso(error)
        ? "Essa corretora tem contas e não pode ser removida."
        : "Não foi possível remover a corretora.",
    );
  }

  revalidatePath("/conta/corretoras");
  redirect("/conta/corretoras");
}

export async function vincularAtivo(
  _anterior: EstadoCorretora,
  dados: FormData,
): Promise<EstadoCorretora> {
  const corretora = String(dados.get("corretora") ?? "");
  const ativo = String(dados.get("ativo") ?? "");
  if (!corretora || !ativo) return { erro: "Escolha o ativo a vincular." };

  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("vincular_ativo", { p_corretora: corretora, p_ativo: ativo });
  if (error) {
    if (error.code === "23505") return { erro: "Esse ativo já está vinculado a esta corretora." };
    return { erro: error.message };
  }

  revalidatePath("/conta/corretoras");
  return { ok: true };
}

export async function voltarAoPadrao(dados: FormData) {
  const corretora = String(dados.get("corretora") ?? "");
  const ativo = String(dados.get("ativo") ?? "");
  if (!corretora || !ativo) return;

  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("voltar_ao_padrao", { p_corretora: corretora, p_ativo: ativo });
  if (error) voltarComErro("Não foi possível voltar ao padrão.");

  revalidatePath("/conta/corretoras");
}

export async function desvincularAtivo(dados: FormData) {
  const corretora = String(dados.get("corretora") ?? "");
  const ativo = String(dados.get("ativo") ?? "");
  if (!corretora || !ativo) return;

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("valores_ponto_corretora")
    .delete()
    .eq("corretora", corretora)
    .eq("ativo", ativo);
  if (error) voltarComErro("Não foi possível desvincular o ativo.");

  revalidatePath("/conta/corretoras");
}

export async function atualizarEspecificacao(
  _anterior: EstadoCorretora,
  dados: FormData,
): Promise<EstadoCorretora> {
  const corretora = String(dados.get("corretora") ?? "");
  const ativo = String(dados.get("ativo") ?? "");
  const tamanhoTick = lerNumero(dados.get("tamanho_tick"));
  const valorTick = lerNumero(dados.get("valor_tick"));
  const unidade = String(dados.get("unidade") ?? "");

  if (!corretora || !ativo) return { erro: "Dados inválidos." };
  const erroTick = validarEspecificacao(tamanhoTick, valorTick, unidade);
  if (erroTick) return { erro: erroTick };

  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("valores_ponto_corretora")
    .update({ tamanho_tick: tamanhoTick, valor_tick: valorTick, unidade })
    .eq("corretora", corretora)
    .eq("ativo", ativo)
    .select("id");

  if (error) return { erro: error.message };
  if (!data || data.length === 0) {
    return { erro: "Especificação não encontrada para essa corretora/ativo." };
  }

  revalidatePath("/conta/corretoras");
  return { ok: true };
}
