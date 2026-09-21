/**
 * Conferência rápida da constância. Roda com:
 *   npx tsx src/lib/constancia.check.ts
 * Não é suíte de teste — é o mínimo para não avisar "faz N dias" errado.
 */

import assert from "node:assert/strict";

import { diaLocal, resumoDeConstancia } from "./constancia";

// 20/09/2026 é domingo. Registro na quinta 17/09 às 15h em Brasília.
const domingo = new Date("2026-09-20T15:00:00-03:00");

// diaLocal: o dia é o de Brasília, não o de UTC.
// 22h em Brasília já é o dia seguinte em UTC — o bug clássico do toISOString().
assert.equal(diaLocal(new Date("2026-09-19T22:30:00-03:00")), "2026-09-19");
assert.equal(diaLocal("2026-09-19T01:00:00Z"), "2026-09-18");

// Sem nenhum registro: nada a avisar.
assert.equal(resumoDeConstancia([], domingo), null);
assert.equal(resumoDeConstancia([null, undefined], domingo), null);

// Vale o registro mais recente entre todas as fontes (trade, estudo, backteste).
assert.deepEqual(
  resumoDeConstancia(
    ["2026-09-16T14:00:00-03:00", "2026-09-19T10:00:00-03:00", "2026-09-17T09:00:00-03:00"],
    domingo,
  ),
  { dias: 1, ultimo: "2026-09-19" },
);

// Registrou hoje: zero dias, sem aviso.
assert.deepEqual(resumoDeConstancia(["2026-09-20T09:00:00-03:00"], domingo), { dias: 0, ultimo: "2026-09-20" });

// Às 22h de Brasília "hoje" ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC.
assert.deepEqual(
  resumoDeConstancia(["2026-09-20T08:00:00-03:00"], new Date("2026-09-20T22:30:00-03:00")),
  { dias: 0, ultimo: "2026-09-20" },
);

// O caso da esposa: só operou até quarta, estudou/backtestou no sábado.
assert.deepEqual(
  resumoDeConstancia(["2026-09-16T10:00:00-03:00", "2026-09-19T16:00:00-03:00"], domingo),
  { dias: 1, ultimo: "2026-09-19" },
);

// Registro no futuro (relógio adiantado) não vira dias negativos.
assert.equal(resumoDeConstancia(["2026-09-25T10:00:00-03:00"], domingo)?.dias, 0);

console.log("constancia.check.ts: ok");
