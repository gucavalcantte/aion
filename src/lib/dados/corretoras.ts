import "server-only";

import type { Ativo, Corretora, Moeda } from "@/lib/ativos";
import { clienteServidor } from "@/lib/supabase/servidor";

const n = (v: unknown) => Number(v ?? 0);

export type EspecificacaoAtivo = { valorPonto: number; unidade: string };

/** Valor por ponto + unidade de cada ativo, para a corretora informada. */
export async function especificacoesDaCorretora(
  corretora: Corretora,
): Promise<Partial<Record<Ativo, EspecificacaoAtivo>>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("valores_ponto_corretora")
    .select("ativo, valor_ponto, unidade")
    .eq("corretora", corretora);
  if (error) throw error;

  const mapa: Partial<Record<Ativo, EspecificacaoAtivo>> = {};
  for (const linha of data ?? []) {
    mapa[linha.ativo as Ativo] = { valorPonto: n(linha.valor_ponto), unidade: String(linha.unidade) };
  }
  return mapa;
}

/** Um ativo vinculado a uma corretora, com a especificação DESTA corretora. */
export type VinculoAtivo = {
  ativo: Ativo;
  nome: string;
  tamanhoTick: number;
  valorTick: number;
  /** Calculado pelo banco: valor do tick ÷ tamanho do tick. */
  valorPonto: number;
  unidade: string;
  /** Moeda em que estão os valores padrão do ativo (pode diferir da moeda da corretora). */
  moedaDoPadrao: Moeda;
  /** Tick, valor do tick ou unidade diferentes do padrão do ativo — habilita "Voltar ao padrão". */
  difereDoPadrao: boolean;
};

export type CorretoraCadastrada = {
  id: string;
  nome: Corretora;
  moeda: Moeda;
  /** Quantas contas do usuário usam esta corretora. */
  contas: number;
  vinculos: VinculoAtivo[];
};

/** As corretoras do usuário logado, em ordem alfabética, cada uma com seus ativos vinculados. */
export async function listarCorretorasDoUsuario(): Promise<CorretoraCadastrada[]> {
  const supabase = await clienteServidor();
  const [corretoras, vinculos, ativos, contas] = await Promise.all([
    supabase.from("corretoras").select("id, nome, moeda").order("nome"),
    supabase
      .from("valores_ponto_corretora")
      .select("corretora, ativo, tamanho_tick, valor_tick, valor_ponto, unidade")
      .order("ativo"),
    supabase.from("ativos").select("codigo, nome, moeda, tamanho_tick, valor_tick, unidade"),
    supabase.from("contas").select("corretora"),
  ]);
  if (corretoras.error) throw corretoras.error;
  if (vinculos.error) throw vinculos.error;
  if (ativos.error) throw ativos.error;
  if (contas.error) throw contas.error;

  const padrao = new Map((ativos.data ?? []).map((a) => [String(a.codigo), a]));

  return (corretoras.data ?? []).map((c) => ({
    id: String(c.id),
    nome: String(c.nome),
    moeda: c.moeda as Moeda,
    contas: (contas.data ?? []).filter((conta) => conta.corretora === c.nome).length,
    vinculos: (vinculos.data ?? [])
      .filter((v) => v.corretora === c.nome)
      .map((v) => {
        const a = padrao.get(String(v.ativo));
        return {
          ativo: String(v.ativo),
          nome: a ? String(a.nome) : String(v.ativo),
          tamanhoTick: n(v.tamanho_tick),
          valorTick: n(v.valor_tick),
          valorPonto: n(v.valor_ponto),
          unidade: String(v.unidade),
          moedaDoPadrao: (a?.moeda ?? c.moeda) as Moeda,
          difereDoPadrao:
            !a ||
            n(a.tamanho_tick) !== n(v.tamanho_tick) ||
            n(a.valor_tick) !== n(v.valor_tick) ||
            String(a.unidade) !== String(v.unidade),
        };
      }),
  }));
}
