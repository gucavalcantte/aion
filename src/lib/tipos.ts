import type { Ativo, Moeda } from "./ativos";

export type TempoGrafico = "1m" | "2m" | "3m" | "5m" | "15m" | "60m" | "1D";
export type TipoConta = "Remunerada" | "Simulador";
export type TipoLancamento = "Saque" | "Aporte";

export type Conta = {
  id: string;
  created_at: string;
  numero: string;
  tipo_conta: TipoConta;
  moeda: Moeda;
  saldo_inicial: number;
  meta: number | null;
  mlpt: number;
  mlpd: number;
  is_padrao: boolean;
};

export type Lancamento = {
  id: string;
  conta_id: string;
  data: string;
  tipo: TipoLancamento;
  valor: number;
  observacao: string | null;
};

/** Conta com os números que dependem de trades e lançamentos. */
export type ContaComSaldo = Conta & {
  saldo_atual: number;
  trades: number;
  progresso: { lucro: number; falta: number; percentual: number } | null;
};

export type Estudo = {
  id: string;
  data: string;
  imagem_url: string | null;
  ativo: Ativo;
  tempo_grafico: TempoGrafico;
  observacao: string | null;
};
