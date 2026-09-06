"use server";

import { revalidatePath } from "next/cache";

import { fechamentoDeExecucoes, type LinhaExecucao } from "@/lib/execucoes-trade";
import { TIPOS_EXECUCAO, type TipoExecucao } from "@/lib/opcoes";
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

function linhasDeExecucao(dados: FormData): LinhaExecucao[] {
  const tipos = dados.getAll("execucao_tipo");
  const quantidades = dados.getAll("execucao_quantidade");
  const notasCampo = dados.getAll("execucao_notas");
  const notaTexto = (v: FormDataEntryValue | undefined) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s;
  };
  return tipos.map((tipo, i) => ({
    tipo: String(tipo) as TipoExecucao,
    quantidade: Math.round(decimal(quantidades[i] ?? null) ?? 0),
    notas: notaTexto(notasCampo[i]),
  }));
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

  const tevaParciais = dados.get("teve_parciais") === "on";
  const linhas = tevaParciais ? linhasDeExecucao(dados) : [];

  if (tevaParciais) {
    if (linhas.some((l) => !TIPOS_EXECUCAO.includes(l.tipo))) {
      return { erro: "Tipo de execução inválido." };
    }
    if (linhas.some((l) => l.quantidade < 1)) {
      return { erro: "Cada execução precisa de uma quantidade de contratos maior que zero." };
    }
    const fechamento = fechamentoDeExecucoes(Math.round(contratos), linhas);
    if (!fechamento.fechado) {
      if (!fechamento.temSaida) {
        return { erro: 'Inclua uma execução do tipo "Saída do trade" para fechar a posição.' };
      }
      return {
        erro:
          fechamento.falta > 0
            ? `Faltam ${fechamento.falta} contrato(s) para fechar a posição.`
            : `A soma das execuções passou ${Math.abs(fechamento.falta)} contrato(s) da quantidade da posição.`,
      };
    }
  }

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

  let tradeId = id;
  if (id) {
    const { error } = await supabase.from("trades").update(campos).eq("id", id);
    if (error) return { erro: error.message };
  } else {
    const { data, error } = await supabase.from("trades").insert(campos).select("id").single();
    if (error) return { erro: error.message };
    tradeId = data.id;
  }

  // Substitui sempre — inclusive quando o checkbox veio desmarcado, o que
  // apaga qualquer execução salva antes (evita log "fantasma" desatualizado).
  await supabase.from("execucoes_trade").delete().eq("trade_id", tradeId);
  if (linhas.length > 0) {
    const { error: erroExecucoes } = await supabase.from("execucoes_trade").insert(
      linhas.map((l, i) => ({ trade_id: tradeId, tipo: l.tipo, quantidade: l.quantidade, ordem: i, notas: l.notas })),
    );
    if (erroExecucoes) return { erro: erroExecucoes.message };
  }

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
