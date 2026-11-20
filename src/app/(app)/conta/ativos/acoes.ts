"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { lerNumero, normalizarCodigoAtivo, validarEspecificacao } from "@/lib/contrato";
import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoAtivo = { erro?: string };

export async function salvarAtivo(
  _anterior: EstadoAtivo,
  dados: FormData,
): Promise<EstadoAtivo> {
  const id = String(dados.get("id") ?? "").trim();
  const codigo = normalizarCodigoAtivo(String(dados.get("codigo") ?? ""));
  const nome = String(dados.get("nome") ?? "").trim();
  const moedaPadrao = String(dados.get("moeda") ?? "");
  const tamanhoTick = lerNumero(dados.get("tamanho_tick"));
  const valorTick = lerNumero(dados.get("valor_tick"));
  const unidade = String(dados.get("unidade") ?? "");

  if (!codigo) return { erro: "Use de 1 a 10 letras ou números no código." };
  if (!nome) return { erro: "Informe o nome do ativo." };
  if (moedaPadrao !== "USD" && moedaPadrao !== "BRL") return { erro: "Escolha a moeda dos valores padrão." };
  const erroTick = validarEspecificacao(tamanhoTick, valorTick, unidade);
  if (erroTick) return { erro: erroTick };

  const campos = {
    codigo,
    nome,
    moeda: moedaPadrao,
    tamanho_tick: tamanhoTick,
    valor_tick: valorTick,
    unidade,
  };

  const supabase = await clienteServidor();
  const { error } = id
    ? await supabase.from("ativos").update(campos).eq("id", id)
    : await supabase.from("ativos").insert(campos);

  if (error) {
    // 23505: unique (user_id, codigo). O código já foi normalizado, então "mes" e "MES" caem aqui.
    if (error.code === "23505") return { erro: "Você já tem um ativo com esse código." };
    return { erro: error.message };
  }

  revalidatePath("/conta/ativos");
  redirect("/conta/ativos");
}

export async function removerAtivo(dados: FormData) {
  const id = String(dados.get("id") ?? "");
  if (!id) return;

  const supabase = await clienteServidor();
  const { error } = await supabase.from("ativos").delete().eq("id", id);

  // O banco bloqueia apagar ativo com trades, backtestes ou estudos. ON DELETE
  // RESTRICT levanta 23001 (e NO ACTION, 23503): os dois significam "tem registros".
  if (error) {
    const emUso = error.code === "23001" || error.code === "23503";
    const mensagem = emUso
      ? "Esse ativo tem registros e não pode ser removido."
      : "Não foi possível remover o ativo.";
    redirect(`/conta/ativos?erro=${encodeURIComponent(mensagem)}`);
  }

  revalidatePath("/conta/ativos");
  redirect("/conta/ativos");
}
