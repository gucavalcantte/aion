import { diasSemRegistro } from "@/lib/dados/constancia";
import { data as fData } from "@/lib/formato";

/** A partir daqui vale lembrar. Um ou dois dias é fim de semana. */
const LIMITE = 3;

/**
 * Lembrete, não alarme: sem cor de erro, sem bloqueio, e some sozinho quando
 * algo é registrado. Constância é o que o app mede — mas cobrar com vermelho
 * transformaria a ferramenta em cobrança.
 */
export async function AvisoDeConstancia() {
  const registro = await diasSemRegistro();
  if (!registro || registro.dias < LIMITE) return null;

  return (
    <div className="mb-5 flex items-center gap-3.5 rounded-[11px] border border-accent/40 bg-accent/10 px-[18px] py-3.5">
      <svg width="19" height="19" viewBox="0 0 16 16" fill="none" stroke="var(--accent-soft)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
        <circle cx="8" cy="8" r="6.2" />
        <path d="M8 4.6V8l2.3 1.4" />
      </svg>
      <p className="text-[14.5px] text-ink-2">
        Faz <strong className="text-accent-soft">{registro.dias} dias</strong> que você não registra
        nada no AION. Consistência é o que este app mede.
      </p>
      <p className="ml-auto whitespace-nowrap text-[13.5px] text-ink-4">
        último registro em <span className="num">{fData(registro.ultimo)}</span>
      </p>
    </div>
  );
}
