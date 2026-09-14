const ATIVOS = ["MES", "MNQ", "MGC", "MYM"];

const REGRAS = [
  "Operar só entre 10h30 e 12h00",
  "Mínimo de 1 e máximo de 4 trades no dia",
  "Encerrar o dia após 2 losses seguidos",
  "Ficar de fora 5 minutos antes e depois de notícia",
];

const ABERTURA = ["Marcar as máximas e mínimas da véspera", "Conferir a agenda do dia"];

const EXECUCAO = [
  ["CEB", "Barra elefante na M20", "Só depois do primeiro alvo", "Encostado na M20", "Abaixo da mínima da barra"],
  ["Tail", "Pavio rejeitando a M200", "Não adiciona", "Encostado na M20 e M200", "Abaixo do pavio"],
  ["180", "Troca de cor com força", "Só a favor da tendência", "Longe da M20", "Meio da barra de origem"],
];

const CABECALHO = ["Setup", "Evento", "Adição", "Localização", "Stop inicial"];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="num rounded-[6px] border border-line bg-raised px-[9px] py-[4px] text-[11.5px] text-ink-2">
      {children}
    </span>
  );
}

function Marcador() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-[3px] shrink-0">
      <rect x="1.4" y="1.4" width="13.2" height="13.2" rx="3.4" stroke="var(--line-strong)" />
      <path d="M4.6 8.2 6.9 10.6l4.6-5" stroke="var(--accent-soft)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TelaPlano() {
  return (
    <div className="grid gap-[10px] rounded-[14px] border border-line bg-well p-[18px] lg:grid-cols-[250px_1fr]">
      <div className="rounded-[11px] border border-line-soft bg-card px-[15px] py-[14px]">
        <h4 className="text-[12.5px] text-ink-2">Pré-mercado</h4>

        <div className="mt-[13px] grid grid-cols-2 gap-[8px]">
          <div className="rounded-[8px] bg-well px-[10px] py-[8px]">
            <p className="text-[10.5px] leading-none text-ink-4">MLPT</p>
            <p className="num mt-[7px] text-[14px] leading-none text-ink">US$ 180</p>
          </div>
          <div className="rounded-[8px] bg-well px-[10px] py-[8px]">
            <p className="text-[10.5px] leading-none text-ink-4">MLPD</p>
            <p className="num mt-[7px] text-[14px] leading-none text-ink">US$ 360</p>
          </div>
        </div>
        <p className="mt-[8px] text-[10.5px] leading-snug text-ink-4">
          Lidos da conta selecionada. O plano não guarda cópia.
        </p>

        <div className="mt-[14px] flex flex-wrap gap-[6px]">
          {ATIVOS.map((a) => (
            <Chip key={a}>{a}</Chip>
          ))}
        </div>

        <ul className="mt-[14px] space-y-[7px] border-t border-line-soft pt-[12px]">
          {REGRAS.map((r) => (
            <li key={r} className="text-[11.5px] leading-snug text-ink-2">
              {r}
            </li>
          ))}
        </ul>

        <ul className="mt-[13px] space-y-[7px] border-t border-line-soft pt-[12px]">
          {ABERTURA.map((item) => (
            <li key={item} className="flex gap-[8px] text-[11.5px] leading-snug text-ink-2">
              <Marcador />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-hidden rounded-[11px] border border-line-soft">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-table-head">
              {CABECALHO.map((c) => (
                <th key={c} className="px-[12px] py-[10px] text-[11px] font-medium text-ink-3">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXECUCAO.map((linha) => (
              <tr key={linha[0]} className="border-t border-line-soft bg-table-row align-top">
                <td className="display px-[12px] py-[13px] text-[13px] text-ink">{linha[0]}</td>
                {linha.slice(1).map((celula, i) => (
                  <td key={i} className="px-[12px] py-[13px] text-[11.5px] leading-snug text-ink-2">
                    {celula}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line-soft bg-card px-[12px] py-[10px] text-[11px] text-ink-4">
          Campo vazio não aparece no plano, nem na tela nem na folha impressa.
        </p>
      </div>
    </div>
  );
}
