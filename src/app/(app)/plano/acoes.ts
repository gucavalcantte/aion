"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoPlano = { erro?: string };

const texto = (d: FormData, campo: string) => {
  const v = String(d.get(campo) ?? "").trim();
  return v === "" ? null : v;
};

function inteiro(valor: FormDataEntryValue | null): number | null {
  const t = String(valor ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Lista vinda de vários inputs de mesmo nome; linha vazia é descartada. */
const lista = (d: FormData, campo: string) =>
  d.getAll(campo).map((v) => String(v).trim()).filter(Boolean);

export async function salvarPlano(
  _anterior: EstadoPlano,
  dados: FormData,
): Promise<EstadoPlano> {
  const minTrades = inteiro(dados.get("min_trades"));
  const maxTrades = inteiro(dados.get("max_trades"));

  if (minTrades !== null && maxTrades !== null && minTrades > maxTrades) {
    return { erro: "O mínimo de trades não pode ser maior que o máximo." };
  }

  const inicio = texto(dados, "janela_inicio");
  const fim = texto(dados, "janela_fim");
  if (inicio && fim && inicio >= fim) {
    return { erro: "A janela operacional precisa terminar depois de começar." };
  }

  const campos = {
    janela_inicio: inicio,
    janela_fim: fim,
    min_trades: minTrades,
    max_trades: maxTrades,
    max_loss_seguidos: inteiro(dados.get("max_loss_seguidos")),
    ativos: dados.getAll("ativos").map(String),
    regras: lista(dados, "regras"),
    checklist_abertura: lista(dados, "checklist_abertura"),
    checklist_fechamento: lista(dados, "checklist_fechamento"),
    nota_rodape: texto(dados, "nota_rodape"),
    revisado_em: new Date().toISOString().slice(0, 10),
  };

  const supabase = await clienteServidor();
  const { data: existente } = await supabase.from("plano").select("id").maybeSingle();

  const { error } = existente
    ? await supabase.from("plano").update(campos).eq("id", existente.id)
    : await supabase.from("plano").insert(campos);

  if (error) return { erro: error.message };

  revalidatePath("/plano");
  redirect("/plano");
}
