/**
 * Projeto recém-criado ou recém-acordado no Supabase às vezes responde
 * PGRST303 ("JWT issued at future"): o relógio do PostgREST fica alguns
 * instantes atrás do relógio do Auth que emitiu o token, e um token novo em
 * folha parece vir do futuro. Passa sozinho em segundos — o sintoma era um
 * erro logo depois do login que sumia ao atualizar a página.
 *
 * O remendo fica no fetch, e não em quem chama, porque o erro atinge qualquer
 * consulta: middleware, Server Component e Server Action. O fetch é o único
 * ponto por onde todas passam.
 *
 * Repetir é seguro: PGRST303 é rejeição na porta de entrada, então a consulta
 * não chegou a rodar — nem a de escrita.
 */

const ESPERAS_MS = [600, 1800];

export async function fetchTolerante(
  entrada: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  for (let tentativa = 0; ; tentativa++) {
    const resposta = await fetch(entrada, init);
    if (tentativa >= ESPERAS_MS.length) return resposta;
    if (!(await ehDesalinhamentoDeRelogio(resposta))) return resposta;
    await new Promise((r) => setTimeout(r, ESPERAS_MS[tentativa]));
  }
}

async function ehDesalinhamentoDeRelogio(resposta: Response): Promise<boolean> {
  // Só resposta de erro carrega código; checar antes evita ler o corpo à toa.
  // A cópia existe para não consumir o corpo que o chamador ainda vai ler.
  if (resposta.ok) return false;
  try {
    const corpo = await resposta.clone().json();
    return corpo?.code === "PGRST303";
  } catch {
    return false;
  }
}
