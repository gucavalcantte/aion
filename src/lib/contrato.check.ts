/**
 * Conferência das funções puras de contrato (tick). Roda com:
 *   npx tsx src/lib/contrato.check.ts
 * Não é suíte de teste — é o mínimo para não publicar valor por ponto errado.
 */

import {
  exemploDeTick,
  lerNumero,
  normalizarCodigoAtivo,
  normalizarNomeCorretora,
  validarEspecificacao,
  valorPorPonto,
} from "./contrato";

let falhas = 0;

function eq(nome: string, obtido: unknown, esperado: unknown) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  const ok = a === b;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : ` — obtido ${a}, esperado ${b}`}`);
}

// lerNumero — o ponto decimal digitado ("0.25") nunca pode virar 25
eq('lerNumero "0.25" (ponto decimal)', lerNumero("0.25"), 0.25);
eq('lerNumero "0,25"', lerNumero("0,25"), 0.25);
eq('lerNumero "1.250,5" (milhar + vírgula)', lerNumero("1.250,5"), 1250.5);
eq('lerNumero " 5 "', lerNumero(" 5 "), 5);
eq('lerNumero ""', lerNumero(""), null);
eq("lerNumero null", lerNumero(null), null);
eq('lerNumero "abc"', lerNumero("abc"), null);
eq('lerNumero "1,2,3"', lerNumero("1,2,3"), null);

// valorPorPonto — o catálogo padrão tem que reproduzir os valores de hoje
eq("valorPorPonto MES (0,25 · 1,25)", valorPorPonto(0.25, 1.25), 5);
eq("valorPorPonto MGC (0,1 · 1)", valorPorPonto(0.1, 1), 10);
eq("valorPorPonto WIN (5 · 1)", valorPorPonto(5, 1), 0.2);
eq("valorPorPonto MBT (5 · 0,5)", valorPorPonto(5, 0.5), 0.1);
eq("valorPorPonto MCL (0,01 · 1)", valorPorPonto(0.01, 1), 100);
eq("valorPorPonto tick zero", valorPorPonto(0, 1), null);
eq("valorPorPonto valor do tick zero", valorPorPonto(1, 0), null);
eq("valorPorPonto tick nulo", valorPorPonto(null, 1), null);
eq("valorPorPonto tick negativo", valorPorPonto(-1, 1), null);

// exemploDeTick
eq("exemploDeTick MGC", exemploDeTick(0.1, 1), {
  ticksPorPonto: 10,
  valorPonto: 10,
  stopPontos: 10,
  stopValor: 100,
});
eq("exemploDeTick MES com stop de 4 pontos", exemploDeTick(0.25, 1.25, 4), {
  ticksPorPonto: 4,
  valorPonto: 5,
  stopPontos: 4,
  stopValor: 20,
});
eq("exemploDeTick tick zero", exemploDeTick(0, 1), null);

// validarEspecificacao
eq("validarEspecificacao válida", validarEspecificacao(0.1, 1, "pontos"), null);
eq("validarEspecificacao tick nulo", validarEspecificacao(null, 1, "pontos"), "Informe o tamanho do tick (maior que zero).");
eq("validarEspecificacao valor do tick zero", validarEspecificacao(0.1, 0, "pontos"), "Informe o valor do tick (maior que zero).");
eq("validarEspecificacao unidade inválida", validarEspecificacao(0.1, 1, "x"), "Escolha a unidade do stop.");

// normalizarCodigoAtivo — "mes" e "MES" são o mesmo cadastro
eq('normalizarCodigoAtivo " mes "', normalizarCodigoAtivo(" mes "), "MES");
eq('normalizarCodigoAtivo "mnq2"', normalizarCodigoAtivo("mnq2"), "MNQ2");
eq('normalizarCodigoAtivo "M-ES"', normalizarCodigoAtivo("M-ES"), null);
eq('normalizarCodigoAtivo ""', normalizarCodigoAtivo(""), null);
eq("normalizarCodigoAtivo 11 caracteres", normalizarCodigoAtivo("ABCDEFGHIJK"), null);

// normalizarNomeCorretora
eq("normalizarNomeCorretora colapsa espaços", normalizarNomeCorretora("  Zero   Markets "), "Zero Markets");
eq('normalizarNomeCorretora ""', normalizarNomeCorretora(""), null);
eq("normalizarNomeCorretora 41 caracteres", normalizarNomeCorretora("a".repeat(41)), null);

if (falhas > 0) {
  console.log(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\ntudo certo.");
