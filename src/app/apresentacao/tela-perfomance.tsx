const LINHA =
  "M0.0 141.8 L23.8 154.0 L47.7 139.6 L71.5 119.9 L95.4 109.4 L119.2 97.6 L143.1 85.7 L166.9 73.3 L190.8 58.2 L214.6 48.4 L238.5 33.7 L262.3 16.8 L286.2 26.8 L310.0 10.0 L333.8 19.8 L357.7 29.0 L381.5 41.5 L405.4 120.2 L429.2 105.4 L453.1 117.7 L476.9 107.2 L500.8 115.2 L524.6 122.6 L548.5 108.5 L572.3 94.4 L596.2 81.5 L620.0 94.2";

const AREA = `${LINHA} L620 168 L0 168 Z`;

/** Um dos dez cartões do topo da Perfomance. O número é sempre mono. */
function Indicador({
  rotulo,
  valor,
  tom = "ink",
  rodape,
}: {
  rotulo: string;
  valor: string;
  tom?: "ink" | "gain" | "loss";
  rodape?: React.ReactNode;
}) {
  const cor = tom === "gain" ? "text-gain" : tom === "loss" ? "text-loss" : "text-ink";
  return (
    <div className="rounded-[11px] border border-line-soft bg-card px-[15px] py-[13px]">
      <p className="text-[11.5px] leading-none text-ink-3">{rotulo}</p>
      <p className={`num mt-[10px] text-[20px] leading-none ${cor}`}>{valor}</p>
      {rodape ? <div className="mt-[10px]">{rodape}</div> : null}
    </div>
  );
}

function Barra({ preenchido, tom }: { preenchido: number; tom: "accent" | "loss" }) {
  return (
    <div className="h-[5px] w-full overflow-hidden rounded-full bg-track">
      <div
        className={`h-full rounded-full ${tom === "accent" ? "bg-accent" : "bg-loss"}`}
        style={{ width: `${preenchido}%` }}
      />
    </div>
  );
}

/** Os dez últimos trades, na ordem. Verde é gain, rosa é loss. */
function Sequencia() {
  const ultimos = [1, -1, 1, 1, -1, -1, 1, 1, 1, 1];
  return (
    <div className="flex gap-[3px]">
      {ultimos.map((r, i) => (
        <span
          key={i}
          className={`h-[5px] flex-1 rounded-[2px] ${r > 0 ? "bg-gain" : "bg-loss"}`}
        />
      ))}
    </div>
  );
}

export function TelaPerfomance() {
  return (
    <div className="rounded-[14px] border border-line bg-well p-[18px]">
      <div className="grid grid-cols-2 gap-[10px] lg:grid-cols-4">
        <Indicador rotulo="Saldo atual" valor="US$ 2.582,13" />
        <Indicador
          rotulo="Meta para saque"
          valor="US$ 917,87"
          rodape={<Barra preenchido={41} tom="accent" />}
        />
        <Indicador
          rotulo="Drawdown do pico"
          valor="−US$ 412,80"
          tom="loss"
          rodape={<Barra preenchido={52} tom="loss" />}
        />
        <Indicador
          rotulo="Sequência atual"
          valor="4 gains"
          tom="gain"
          rodape={<Sequencia />}
        />
      </div>

      <figure className="mt-[10px] rounded-[11px] border border-line-soft bg-card p-[15px]">
        <figcaption className="mb-[14px] flex items-baseline justify-between">
          <span className="text-[12.5px] text-ink-2">Evolução da conta</span>
          <span className="num text-[11.5px] text-ink-4">26 trades</span>
        </figcaption>

        <svg viewBox="0 0 620 168" className="w-full" role="img" aria-label="Saldo acumulado ao longo dos trades, com a meta e o saque marcados">
          <defs>
            <linearGradient id="apr-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* meta da conta: tracejado, nunca sólido — não é dado, é alvo */}
          <line x1="0" y1="27.2" x2="620" y2="27.2" stroke="var(--accent-soft)" strokeWidth="1" strokeDasharray="5 4" opacity="0.55" />
          <text x="614" y="22" textAnchor="end" fill="var(--accent-soft)" fontSize="10.5" opacity="0.9">meta</text>

          <path d={AREA} fill="url(#apr-area)" />
          <path
            d={LINHA}
            fill="none"
            stroke="var(--accent-soft)"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* o degrau do saque aparece; como perda, não conta em lugar nenhum */}
          <circle cx="405.4" cy="120.2" r="3.6" fill="var(--well)" stroke="var(--ref)" strokeWidth="1.6" />
          <text x="399" y="139" textAnchor="end" fill="var(--ink-4)" fontSize="10.5">saque</text>
        </svg>
      </figure>
    </div>
  );
}
