const COLUNAS = [
  "#",
  "Data",
  "Ativo",
  "Período",
  "Operação",
  "Setup",
  "Evento",
  "Stop",
  "Entrada",
  "M20",
  "M200",
  "Alinhamento",
  "Localização",
  "Resultado",
  "R:R",
  "Notas",
];

const REGISTROS = [
  ["142", "12/09", "MNQ", "Manhã", "Compra", "CEB", "Barra elefante", "18,0", "Confirmada", "Inclinada ↑", "Inclinada ↑", "A favor", "Encostado na M20", "Gain", "2:1", "Abriu com força"],
  ["141", "12/09", "MES", "Manhã", "Venda", "CEB", "Tail", "6,5", "Confirmada", "Plana", "Inclinada ↓", "Contra", "Longe da M20", "Loss", "LOSS", "Entrei contra"],
  ["140", "11/09", "MNQ", "Tarde", "Compra", "CEB", "Troca de cor", "22,0", "Antecipada", "Inclinada ↑", "Plana", "Lateral", "Próximo à M20", "Gain", "1:1", "Saí cedo demais"],
  ["139", "11/09", "MGC", "Manhã", "Compra", "CEB", "180", "4,2", "Confirmada", "Inclinada ↑", "Inclinada ↑", "A favor", "Encostado na M20 e M200", "Gain", "3:1", "Livro de manual"],
  ["138", "10/09", "MES", "Noite", "Venda", "CEB", "Barra elefante", "9,0", "Antecipada", "Inclinada ↓", "Inclinada ↓", "A favor", "Longe da M20", "Loss", "LOSS", "Stop curto"],
];

function Tabela() {
  return (
    <div className="relative overflow-hidden rounded-[11px] border border-line-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead>
            <tr className="bg-table-head">
              {COLUNAS.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap px-[11px] py-[9px] text-[11px] font-medium text-ink-3"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REGISTROS.map((linha) => (
              <tr key={linha[0]} className="border-t border-line-soft bg-table-row">
                {linha.map((celula, i) => {
                  const ehNumero = i === 0 || i === 7;
                  const ehResultado = i === 13;
                  const ehRR = i === 14;
                  const perdeu = linha[13] === "Loss";
                  return (
                    <td
                      key={i}
                      className={[
                        "whitespace-nowrap px-[11px] py-[9px] text-[12px]",
                        ehNumero || ehRR ? "num" : "",
                        ehResultado ? (perdeu ? "text-loss" : "text-gain") : "text-ink-2",
                        i === 0 ? "text-ink-4" : "",
                      ].join(" ")}
                    >
                      {celula}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* A tabela continua para a direita. O esmaecido diz isso, mas fica estreito
          de propósito: mais largo que isto e ele apaga a coluna Resultado. */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-7"
        style={{ background: "linear-gradient(90deg, transparent, var(--well))" }}
      />
    </div>
  );
}

function Contexto({
  nome,
  observado,
  limite,
  amostra,
  tom,
}: {
  nome: string;
  observado: string;
  limite: number;
  amostra: string;
  tom: "melhor" | "pior";
}) {
  return (
    <li className="py-[11px]">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[12px] leading-snug text-ink-2">{nome}</span>
        <span className="num shrink-0 text-[12px] text-ink-4">{amostra}</span>
      </div>
      <div className="mt-[9px] flex items-center gap-[10px]">
        <div className="relative h-[6px] flex-1 rounded-full bg-track">
          <div
            className={`h-full rounded-full ${tom === "melhor" ? "bg-accent" : "bg-loss"}`}
            style={{ width: `${limite}%` }}
          />
        </div>
        <span className="num w-[112px] shrink-0 text-right text-[11.5px] text-ink-3">
          {observado}{" "}
          <span className="text-ink-4">
            {tom === "melhor" ? "· piso" : "· teto"} {limite.toFixed(1).replace(".", ",")}%
          </span>
        </span>
      </div>
    </li>
  );
}

export function TelaBackteste() {
  return (
    <div className="rounded-[14px] border border-line bg-well p-[18px]">
      <Tabela />

      <div className="mt-[10px] grid gap-[10px] lg:grid-cols-2">
        <div className="rounded-[11px] border border-line-soft bg-card px-[15px] py-[13px]">
          <h4 className="text-[12.5px] text-ink-2">Melhores contextos</h4>
          <ul className="mt-1 divide-y divide-line-soft">
            <Contexto
              nome="Confirmada, a favor da tendência, encostado na M20"
              observado="86,4%"
              limite={66.7}
              amostra="22"
              tom="melhor"
            />
            <Contexto
              nome="Confirmada, lateral, próximo à M20"
              observado="78,6%"
              limite={52.4}
              amostra="14"
              tom="melhor"
            />
            <Contexto
              nome="Confirmada, a favor da tendência, próximo à M20"
              observado="80,0%"
              limite={49.0}
              amostra="10"
              tom="melhor"
            />
          </ul>
          <p className="mt-[13px] border-t border-line-soft pt-[11px] text-[11.5px] leading-snug text-ink-4">
            4 combinações ficaram de fora por terem menos de 6 registros.
          </p>
        </div>

        <div className="rounded-[11px] border border-line-soft bg-card px-[15px] py-[13px]">
          <h4 className="text-[12.5px] text-ink-2">Piores contextos</h4>
          <ul className="mt-1 divide-y divide-line-soft">
            <Contexto
              nome="Antecipada, contra a tendência, longe da M20"
              observado="25,0%"
              limite={53.2}
              amostra="12"
              tom="pior"
            />
            <Contexto
              nome="Antecipada, contra a tendência, próximo à M20"
              observado="36,4%"
              limite={64.6}
              amostra="11"
              tom="pior"
            />
            <Contexto
              nome="Antecipada, lateral, longe da M20"
              observado="33,3%"
              limite={64.6}
              amostra="9"
              tom="pior"
            />
          </ul>
          <p className="mt-[13px] border-t border-line-soft pt-[11px] text-[11.5px] leading-snug text-ink-4">
            Aqui a barra é o teto, não o piso, e só entra quem fica abaixo dos 68,3% do
            setup.
          </p>
        </div>
      </div>
    </div>
  );
}
