/**
 * Conferência rápida do fechamento de execuções (parcial/adição/saída).
 * Roda com: tsx src/lib/execucoes-trade.check.ts
 * Não é suíte de teste — é o mínimo para não deixar salvar um trade com
 * contratos sobrando ou faltando.
 */

import { fechamentoDeExecucoes } from "./execucoes-trade";

let falhas = 0;

function eq(nome: string, obtido: unknown, esperado: unknown) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  const ok = a === b;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : ` — obtido ${a}, esperado ${b}`}`);
}

eq(
  "fecha certo sem adição",
  fechamentoDeExecucoes(3, [
    { tipo: "Parcial", quantidade: 2, notas: null },
    { tipo: "Saída do trade", quantidade: 1, notas: null },
  ]),
  { alvo: 3, somaSaida: 3, falta: 0, temSaida: true, fechado: true },
);

eq(
  "fecha certo com adição",
  fechamentoDeExecucoes(2, [
    { tipo: "Adição", quantidade: 1, notas: null },
    { tipo: "Parcial", quantidade: 2, notas: null },
    { tipo: "Saída do trade", quantidade: 1, notas: null },
  ]),
  { alvo: 3, somaSaida: 3, falta: 0, temSaida: true, fechado: true },
);

eq(
  "falta contrato para fechar",
  fechamentoDeExecucoes(3, [{ tipo: "Parcial", quantidade: 2, notas: null }]),
  { alvo: 3, somaSaida: 2, falta: 1, temSaida: false, fechado: false },
);

eq(
  "soma bate mas sem Saída do trade não fecha",
  fechamentoDeExecucoes(3, [{ tipo: "Parcial", quantidade: 3, notas: null }]),
  { alvo: 3, somaSaida: 3, falta: 0, temSaida: false, fechado: false },
);

eq(
  "soma além do alvo não fecha",
  fechamentoDeExecucoes(3, [{ tipo: "Saída do trade", quantidade: 4, notas: null }]),
  { alvo: 3, somaSaida: 4, falta: -1, temSaida: true, fechado: false },
);

eq(
  "sem nenhuma execução",
  fechamentoDeExecucoes(3, []),
  { alvo: 3, somaSaida: 0, falta: 3, temSaida: false, fechado: false },
);

if (falhas > 0) {
  console.log(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\ntudo certo.");
