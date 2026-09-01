"use server";

import { revalidatePath } from "next/cache";

import { UNIDADES } from "@/lib/opcoes";
import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoEspecificacao = { erro?: string; ok?: boolean };

/** "1.500,50" e "1500.50" viram 1500.5. */
function numero(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const limpo = texto.replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

const UNIDADES_VALIDAS: readonly string[] = UNIDADES;

export async function atualizarEspecificacao(
  _anterior: EstadoEspecificacao,
  dados: FormData,
): Promise<EstadoEspecificacao> {
  const corretora = String(dados.get("corretora") ?? "");
  const ativo = String(dados.get("ativo") ?? "");
  const valorPonto = numero(dados.get("valor_ponto"));
  const unidade = String(dados.get("unidade") ?? "");

  if (!corretora || !ativo) return { erro: "Dados inválidos." };
  if (valorPonto === null || valorPonto <= 0) {
    return { erro: "Informe um valor por ponto maior que zero." };
  }
  if (!UNIDADES_VALIDAS.includes(unidade)) return { erro: "Escolha a unidade." };

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("valores_ponto_corretora")
    .update({ valor_ponto: valorPonto, unidade })
    .eq("corretora", corretora)
    .eq("ativo", ativo);

  if (error) return { erro: error.message };

  revalidatePath("/conta/corretoras");
  return { ok: true };
}
