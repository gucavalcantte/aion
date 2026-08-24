"use server";

import { revalidatePath } from "next/cache";

import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoLinha = { erro?: string; ok?: boolean };

const texto = (d: FormData, campo: string) => {
  const v = String(d.get(campo) ?? "").trim();
  return v === "" ? null : v;
};

function decimal(valor: FormDataEntryValue | null): number | null {
  const t = String(valor ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const OBRIGATORIOS = [
  ["ativo", "ativo"],
  ["data", "data"],
  ["periodo", "período"],
  ["operacao", "operação"],
  ["setup_id", "setup"],
  ["evento", "evento"],
  ["entrada", "entrada"],
  ["m20", "M20"],
  ["m200", "M200"],
  ["alinhamento", "alinhamento"],
  ["localizacao", "localização"],
  ["resultado", "resultado"],
] as const;

export async function salvarBackteste(
  _anterior: EstadoLinha,
  dados: FormData,
): Promise<EstadoLinha> {
  const id = String(dados.get("id") ?? "").trim();
  const tempo = String(dados.get("tempo_grafico") ?? "");

  const faltando = OBRIGATORIOS.filter(([campo]) => !texto(dados, campo));
  if (faltando.length > 0) {
    const nomes = faltando.map(([, rotulo]) => rotulo);
    return {
      erro:
        nomes.length === 1
          ? `Falta preencher: ${nomes[0]}.`
          : `Faltam ${nomes.length} campos: ${nomes.join(", ")}.`,
    };
  }

  const stop = decimal(dados.get("tamanho_stop"));
  if (stop === null || stop <= 0) return { erro: "Informe o tamanho do stop." };

  const rr = decimal(dados.get("risco_retorno"));
  if (rr === null) return { erro: "Escolha o risco retorno." };

  const campos = {
    tempo_grafico: tempo,
    ativo: texto(dados, "ativo"),
    data: texto(dados, "data"),
    periodo: texto(dados, "periodo"),
    operacao: texto(dados, "operacao"),
    setup_id: texto(dados, "setup_id"),
    evento: texto(dados, "evento"),
    tamanho_stop: stop,
    entrada: texto(dados, "entrada"),
    m20: texto(dados, "m20"),
    m200: texto(dados, "m200"),
    alinhamento: texto(dados, "alinhamento"),
    localizacao: texto(dados, "localizacao"),
    resultado: texto(dados, "resultado"),
    risco_retorno: rr,
    notas: texto(dados, "notas"),
  };

  const supabase = await clienteServidor();
  const { error } = id
    ? await supabase.from("backtestes").update(campos).eq("id", id)
    : await supabase.from("backtestes").insert(campos);

  if (error) return { erro: error.message };

  revalidatePath(`/backteste/${tempo}`);
  revalidatePath("/backteste");
  return { ok: true };
}

export async function removerBackteste(dados: FormData) {
  const id = String(dados.get("id") ?? "");
  const tempo = String(dados.get("tempo_grafico") ?? "");
  if (!id) return;

  const supabase = await clienteServidor();
  await supabase.from("backtestes").delete().eq("id", id);

  revalidatePath(`/backteste/${tempo}`);
  revalidatePath("/backteste");
}
