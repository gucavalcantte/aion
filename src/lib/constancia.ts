/** O app é usado no Brasil; o servidor (Vercel) roda em UTC. */
const FUSO = "America/Sao_Paulo";

const formatadorDoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Dia civil (AAAA-MM-DD) de um instante, no fuso de Brasília. `toISOString()`
 * daria o dia em UTC, que vira 3h antes: depois das 21h o "hoje" já seria amanhã.
 */
export function diaLocal(instante: Date | string): string {
  return formatadorDoDia.format(typeof instante === "string" ? new Date(instante) : instante);
}

/** Dias inteiros entre duas datas ISO (AAAA-MM-DD), sem depender de fuso. */
function diasEntre(de: string, ate: string) {
  const ms = Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Quanto tempo faz que o usuário mexeu no app. Recebe os `created_at` mais
 * recentes de cada fonte (trade, estudo, backteste) e vale o maior.
 *
 * Usa o instante em que o registro foi criado, não o campo `data` dele: `data`
 * é o dia do pregão (ou, no backteste, de um pregão antigo), e cadastrar hoje o
 * estudo de sexta continua sendo constância de hoje.
 */
export function resumoDeConstancia(criadoEm: (string | null | undefined)[], agora = new Date()) {
  const dias = criadoEm.filter((c): c is string => Boolean(c)).map(diaLocal);
  if (dias.length === 0) return null;

  const ultimo = dias.sort().reverse()[0];
  return { dias: diasEntre(ultimo, diaLocal(agora)), ultimo };
}
