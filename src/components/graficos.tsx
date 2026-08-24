import { moeda } from "@/lib/formato";

/**
 * Gráficos em SVG puro, renderizados no servidor. Sem biblioteca: são duas
 * formas simples, e uma dependência de charts custaria mais em peso e em
 * teimosia com o tema do que escrever as coordenadas.
 */

const L = 62; // margem esquerda para os rótulos do eixo
const R = 12;
const TOPO = 16;
const BASE = 176;
const ALTURA = 210;

function escala(valores: number[]) {
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const folga = (max - min) * 0.12 || Math.abs(max) * 0.12 || 1;
  return { min: min - folga, max: max + folga };
}

const arredondar = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 10000) return `$${Math.round(v / 1000)}k`;
  if (abs >= 1000) return `$${(v / 1000).toFixed(1).replace(".", ",")}k`;
  return moeda(v).replace(",00", "");
};

export function CurvaDeCapital({
  pontos,
  meta,
  largura = 560,
}: {
  pontos: { data: string; saldo: number; tipo: string }[];
  meta: number | null;
  largura?: number;
}) {
  if (pontos.length < 2) {
    return <Vazio texto="A curva aparece a partir do segundo trade." />;
  }

  const valores = pontos.map((p) => p.saldo);
  if (meta !== null) valores.push(meta);
  const { min, max } = escala(valores);

  const x = (i: number) => L + (i / (pontos.length - 1)) * (largura - L - R);
  const y = (v: number) => BASE - ((v - min) / (max - min)) * (BASE - TOPO);

  const linha = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.saldo).toFixed(1)}`).join(" ");
  const area = `${linha} L${x(pontos.length - 1).toFixed(1)},${BASE} L${L},${BASE} Z`;

  const marcas = [max, min + (max - min) * 0.66, min + (max - min) * 0.33, min];
  const ultimo = pontos[pontos.length - 1];

  return (
    <svg viewBox={`0 0 ${largura} ${ALTURA}`} className="block h-auto w-full" role="img" aria-label="Evolução do saldo da conta">
      <defs>
        <linearGradient id="areaCurva" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-soft)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent-soft)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {marcas.map((v, i) => (
        <g key={i}>
          <line x1={L} y1={y(v)} x2={largura - R} y2={y(v)} stroke="var(--line-soft)" strokeWidth="1" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--ink-4)" className="num">
            {arredondar(v)}
          </text>
        </g>
      ))}

      {meta !== null && meta >= min && meta <= max && (
        <>
          <line x1={L} y1={y(meta)} x2={largura - R} y2={y(meta)} stroke="var(--accent)" strokeWidth="1.4" strokeDasharray="5 4" />
          <text x={largura - R} y={y(meta) - 6} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--accent)">
            META DE SAQUE
          </text>
        </>
      )}

      <path d={area} fill="url(#areaCurva)" />
      <path d={linha} fill="none" stroke="var(--accent-soft)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Saque e aporte marcados: ver o degrau é útil, contá-lo como perda não. */}
      {pontos.map((p, i) =>
        p.tipo === "saque" || p.tipo === "aporte" ? (
          <circle key={i} cx={x(i)} cy={y(p.saldo)} r="4" fill="var(--card)" stroke="var(--ink-3)" strokeWidth="2">
            <title>{p.tipo === "saque" ? "Saque" : "Aporte"} em {p.data}</title>
          </circle>
        ) : null,
      )}

      <circle cx={x(pontos.length - 1)} cy={y(ultimo.saldo)} r="3.6" fill="var(--accent-soft)" />
    </svg>
  );
}

export function ResultadoPorOperacao({
  trades,
  mlpt,
  largura = 560,
}: {
  trades: { resultado: number; data: string }[];
  mlpt: number;
  largura?: number;
}) {
  if (trades.length === 0) {
    return <Vazio texto="Cada barra é um trade. Registre o primeiro." />;
  }

  const valores = trades.map((t) => t.resultado);
  const extremo = Math.max(Math.abs(Math.min(...valores, -mlpt)), Math.abs(Math.max(...valores, mlpt))) * 1.15;

  const zero = (TOPO + BASE) / 2;
  const y = (v: number) => zero - (v / extremo) * (zero - TOPO);

  const passo = (largura - L - R) / trades.length;
  const espessura = Math.max(3, Math.min(11, passo - 5));

  const marcas = [extremo, extremo / 2, 0, -extremo / 2];

  return (
    <svg viewBox={`0 0 ${largura} ${ALTURA}`} className="block h-auto w-full" role="img" aria-label="Resultado por operação">
      {marcas.map((v, i) => (
        <g key={i}>
          <line
            x1={L}
            y1={y(v)}
            x2={largura - R}
            y2={y(v)}
            stroke={v === 0 ? "var(--line-strong)" : "var(--line-soft)"}
            strokeWidth="1"
          />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill={v === 0 ? "var(--ink-3)" : "var(--ink-4)"} className="num">
            {arredondar(v)}
          </text>
        </g>
      ))}

      {/* MLPT nos dois lados: mostra se cada trade coube no risco aceito. */}
      {[mlpt, -mlpt].map((v) => (
        <line key={v} x1={L} y1={y(v)} x2={largura - R} y2={y(v)} stroke="var(--ref)" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.7" />
      ))}

      {trades.map((t, i) => {
        const alto = Math.abs(y(t.resultado) - zero);
        const acima = t.resultado >= 0;
        return (
          <rect
            key={i}
            x={L + i * passo + (passo - espessura) / 2}
            y={acima ? y(t.resultado) : zero}
            width={espessura}
            height={Math.max(1.5, alto)}
            rx="2.5"
            fill={t.resultado > 0 ? "var(--gain)" : t.resultado < 0 ? "var(--loss)" : "var(--neutral)"}
          >
            <title>
              {t.data} · {moeda(t.resultado, true)}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="flex h-[176px] items-center justify-center rounded-lg border border-dashed border-line-strong">
      <p className="text-[13.5px] text-ink-4">{texto}</p>
    </div>
  );
}
