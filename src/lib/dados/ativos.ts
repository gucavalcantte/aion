import "server-only";

import type { Moeda } from "@/lib/ativos";
import { clienteServidor } from "@/lib/supabase/servidor";

const n = (v: unknown) => Number(v ?? 0);

/** Ativo do cadastro do usuário, com a especificação PADRÃO em tick. */
export type AtivoCadastrado = {
  id: string;
  codigo: string;
  nome: string;
  /** Moeda em que estão os valores padrão — não restringe em que corretora o ativo é usado. */
  moeda: Moeda;
  tamanhoTick: number;
  valorTick: number;
  /** Calculado pelo banco: valor do tick ÷ tamanho do tick. */
  valorPonto: number;
  unidade: string;
};

/** Os ativos do usuário logado, em ordem alfabética de código. */
export async function listarAtivos(): Promise<AtivoCadastrado[]> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("ativos")
    .select("id, codigo, nome, moeda, tamanho_tick, valor_tick, valor_ponto, unidade")
    .order("codigo");
  if (error) throw error;

  return (data ?? []).map((a) => ({
    id: String(a.id),
    codigo: String(a.codigo),
    nome: String(a.nome),
    moeda: a.moeda as Moeda,
    tamanhoTick: n(a.tamanho_tick),
    valorTick: n(a.valor_tick),
    valorPonto: n(a.valor_ponto),
    unidade: String(a.unidade),
  }));
}
