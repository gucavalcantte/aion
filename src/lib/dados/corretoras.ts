import "server-only";

import { CORRETORAS, type Ativo, type Corretora } from "@/lib/ativos";
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

export type LinhaCorretora = { ativo: Ativo; valorPonto: number; unidade: string };

/** As três corretoras, cada uma com os ativos que ela cobre — para a tela Corretoras. */
export async function listarCorretoras(): Promise<
  { corretora: Corretora; ativos: LinhaCorretora[] }[]
> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("valores_ponto_corretora")
    .select("corretora, ativo, valor_ponto, unidade")
    .order("corretora")
    .order("ativo");
  if (error) throw error;

  const porCorretora = new Map<Corretora, LinhaCorretora[]>();
  for (const linha of data ?? []) {
    const corretora = linha.corretora as Corretora;
    const lista = porCorretora.get(corretora) ?? [];
    lista.push({
      ativo: linha.ativo as Ativo,
      valorPonto: n(linha.valor_ponto),
      unidade: String(linha.unidade),
    });
    porCorretora.set(corretora, lista);
  }

  return CORRETORAS.map((corretora) => ({ corretora, ativos: porCorretora.get(corretora) ?? [] }));
}
