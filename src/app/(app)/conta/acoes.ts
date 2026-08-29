"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoConta = { erro?: string };

/** "1.500,50" e "1500.50" viram 1500.5. Campo vazio vira null. */
function numero(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const limpo = texto.replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export async function salvarConta(
  _anterior: EstadoConta,
  dados: FormData,
): Promise<EstadoConta> {
  const id = String(dados.get("id") ?? "").trim();
  const numeroConta = String(dados.get("numero") ?? "").trim();
  const tipo = String(dados.get("tipo_conta") ?? "");
  const moedaConta = String(dados.get("moeda") ?? "");
  const saldoInicial = numero(dados.get("saldo_inicial"));
  const meta = numero(dados.get("meta"));
  const mlpt = numero(dados.get("mlpt"));
  const mlpd = numero(dados.get("mlpd"));
  const isPadrao = dados.get("is_padrao") === "on";

  if (!numeroConta) return { erro: "Informe o número da conta." };
  if (tipo !== "Remunerada" && tipo !== "Simulador") return { erro: "Escolha o tipo da conta." };
  if (moedaConta !== "USD" && moedaConta !== "BRL") return { erro: "Escolha a moeda da conta." };
  if (saldoInicial === null) return { erro: "Informe o saldo inicial." };
  if (mlpt === null || mlpt <= 0) return { erro: "Informe o MLPT (maior que zero)." };
  if (mlpd === null || mlpd <= 0) return { erro: "Informe o MLPD (maior que zero)." };
  if (meta !== null && meta <= 0) return { erro: "A meta precisa ser maior que zero, ou vazia." };
  if (mlpd < mlpt) return { erro: "O MLPD não pode ser menor que o MLPT." };

  const supabase = await clienteServidor();

  // Só uma conta padrão por usuário — o banco tem índice único, então é preciso
  // liberar a anterior antes de marcar a nova.
  if (isPadrao) {
    const limpar = supabase.from("contas").update({ is_padrao: false }).eq("is_padrao", true);
    const { error } = id ? await limpar.neq("id", id) : await limpar;
    if (error) return { erro: "Não foi possível trocar a conta padrão." };
  }

  const campos = {
    numero: numeroConta,
    tipo_conta: tipo,
    moeda: moedaConta,
    saldo_inicial: saldoInicial,
    meta,
    mlpt,
    mlpd,
    is_padrao: isPadrao,
  };

  const { error } = id
    ? await supabase.from("contas").update(campos).eq("id", id)
    : await supabase.from("contas").insert(campos);

  if (error) return { erro: error.message };

  revalidatePath("/conta");
  redirect("/conta");
}

export async function removerConta(dados: FormData) {
  const id = String(dados.get("id") ?? "");
  if (!id) return;

  const supabase = await clienteServidor();
  const { error } = await supabase.from("contas").delete().eq("id", id);

  // O banco bloqueia apagar conta com trades (on delete restrict). Melhor
  // avisar do que apagar o histórico junto.
  if (error) {
    redirect(`/conta?erro=${encodeURIComponent("Essa conta tem trades registrados e não pode ser removida.")}`);
  }

  revalidatePath("/conta");
  redirect("/conta");
}
