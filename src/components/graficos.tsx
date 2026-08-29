import type { MarcaDeCaixa, PontoDaCurva } from "@/lib/dados/trades";
import { moeda, simboloDaMoeda } from "@/lib/formato";
import type { Moeda } from "@/lib/ativos";

/**
 * SVG puro, renderizado no servidor. Sem biblioteca de charts: são duas formas
 * simples, e uma dependência custaria mais em peso e em teimosia com o tema do
 * que escrever as coordenadas. As cores saem dos tokens, então o modo claro
 * funciona sem trabalho extra.
 */

const ESQ = 58;
const DIR = 14;
const TOPO = 18;
const BASE = 168;
const EIXO_X = 190;
const ALTURA = 200;

/** Escala com folga e zero sempre dentro, para a linha de breakeven existir. */
function escala(valores: number[]) {
  const min = Math.min(0, ...valores);
  const max = Math.max(0, ...valores);
  const folga = (max - min) * 0.12 || 100;
  return { min: min - folga, max: max + folga };
}

function marcasDoEixo(min: number, max: number, quantidade = 5) {
  const passo = (max - min) / (quantidade - 1);
  return Array.from({ length: quantidade }, (_, i) => min + passo * i);
}

function curto(v: number, simbolo: string) {
  const abs = Math.abs(v);
  if (abs >= 10000) return `${v < 0 ? "-" : ""}${simbolo}${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${v < 0 ? "-" : ""}${simbolo}${(abs / 1000).toFixed(1).replace(".", ",")}k`;
  return `${v < 0 ? "-" : ""}${simbolo}${Math.round(abs)}`;
}

/** Rótulos do eixo X sem amontoar: mostra no máximo ~12. */
function passoDoEixoX(n: number) {
  return Math.max(1, Math.ceil(n / 12));
}

function Legenda({ itens }: { itens: { cor: string; texto: string; tracejado?: boolean }[] }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
      {itens.map((item) => (
        <span key={item.texto} className="flex items-center gap-2 text-[12.5px] text-ink-3">
          {item.tracejado ? (
            <svg width="20" height="6" aria-hidden>
              <line x1="0" y1="3" x2="20" y2="3" stroke={item.cor} strokeWidth="2" strokeDasharray="4 3" />
            </svg>
          ) : (
            <span className="h-[10px] w-[16px] rounded-[3px]" style={{ background: item.cor }} />
          )}
          {item.texto}
        </span>
      ))}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="flex h-[190px] items-center justify-center rounded-lg border border-dashed border-line-strong">
      <p className="text-[13.5px] text-ink-4">{texto}</p>
    </div>
  );
}

export function CurvaDeCapital({
  pontos,
  marcadores,
  meta,
  moedaConta,
  largura = 560,
}: {
  pontos: PontoDaCurva[];
  marcadores: MarcaDeCaixa[];
  /** Meta em lucro acumulado, não em saldo. */
  meta: number | null;
  moedaConta: Moeda;
  largura?: number;
}) {
  if (pontos.length < 2) return <Vazio texto="A curva aparece a partir do segundo trade." />;

  const simbolo = simboloDaMoeda(moedaConta);

  const valores = pontos.map((p) => p.lucro);
  if (meta !== null) valores.push(meta);
  const { min, max } = escala(valores);

  const x = (i: number) => ESQ + ((i - 1) / (pontos.length - 1)) * (largura - ESQ - DIR);
  const y = (v: number) => BASE - ((v - min) / (max - min)) * (BASE - TOPO);

  // Média móvel: enxerga a tendência através do zigue-zague.
  const janela = Math.max(3, Math.round(pontos.length / 8));
  const media = pontos.map((_, i) => {
    const fatia = pontos.slice(Math.max(0, i - janela + 1), i + 1);
    return fatia.reduce((a, p) => a + p.lucro, 0) / fatia.length;
  });

  const caminho = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const linha = caminho(valores.slice(0, pontos.length));
  const area = `${linha} L${x(pontos.length).toFixed(1)},${y(0)} L${ESQ},${y(0)} Z`;
  const passo = passoDoEixoX(pontos.length);

  return (
    <div>
      <Legenda
        itens={[
          { cor: "var(--accent-soft)", texto: "Lucro acumulado" },
          { cor: "var(--ink-4)", texto: "Média" },
          ...(meta !== null ? [{ cor: "var(--accent)", texto: "Meta", tracejado: true }] : []),
        ]}
      />
      <svg viewBox={`0 0 ${largura} ${ALTURA}`} className="block h-auto w-full" role="img" aria-label="Lucro acumulado da conta">
        <defs>
          <linearGradient id="areaLucro" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-soft)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--accent-soft)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {marcasDoEixo(min, max).map((v, i) => (
          <g key={i}>
            <line x1={ESQ} y1={y(v)} x2={largura - DIR} y2={y(v)} stroke="var(--line-soft)" strokeWidth="1" />
            <text x={ESQ - 8} y={y(v) + 4} textAnchor="end" fontSize="11.5" fill="var(--ink-4)" className="num">
              {curto(v, simbolo)}
            </text>
          </g>
        ))}

        {/* Breakeven: acima disso a conta está no lucro. */}
        <line x1={ESQ} y1={y(0)} x2={largura - DIR} y2={y(0)} stroke="var(--ink-4)" strokeWidth="1.2" strokeDasharray="4 4" />

        {meta !== null && meta <= max && (
          <>
            <line x1={ESQ} y1={y(meta)} x2={largura - DIR} y2={y(meta)} stroke="var(--accent)" strokeWidth="1.4" strokeDasharray="5 4" />
            <text x={largura - DIR} y={y(meta) - 6} textAnchor="end" fontSize="10.5" fontWeight="600" fill="var(--accent)">
              META
            </text>
          </>
        )}

        <path d={area} fill="url(#areaLucro)" />
        <path d={linha} fill="none" stroke="var(--accent-soft)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={caminho(media)} fill="none" stroke="var(--ink-4)" strokeWidth="1.8" strokeLinejoin="round" opacity="0.85" />

        {/* Um ponto por trade, na cor do resultado daquele trade. */}
        {pontos.map((p) => (
          <circle
            key={p.i}
            cx={x(p.i)}
            cy={y(p.lucro)}
            r={pontos.length > 80 ? 1.8 : 2.8}
            fill={p.resultado > 0 ? "var(--gain)" : p.resultado < 0 ? "var(--loss)" : "var(--neutral)"}
          >
            <title>{`#${p.i} · ${p.data} · ${moeda(p.resultado, moedaConta, true)} · acumulado ${moeda(p.lucro, moedaConta, true)}`}</title>
          </circle>
        ))}

        {/* Saque e aporte: marca vertical, nunca degrau na curva. */}
        {marcadores.map((m, i) => (
          <g key={i}>
            <line x1={x(Math.max(1, m.i))} y1={TOPO} x2={x(Math.max(1, m.i))} y2={BASE} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 3" opacity="0.7">
              <title>{`${m.tipo} de ${moeda(m.valor, moedaConta)} em ${m.data}`}</title>
            </line>
            <text x={x(Math.max(1, m.i))} y={TOPO - 5} textAnchor="middle" fontSize="10" fill="var(--ink-3)">
              {m.tipo === "Saque" ? "saque" : "aporte"}
            </text>
          </g>
        ))}

        {pontos.map((p) =>
          (p.i - 1) % passo === 0 || p.i === pontos.length ? (
            <text key={`x${p.i}`} x={x(p.i)} y={EIXO_X} textAnchor="middle" fontSize="11" fill="var(--ink-4)" className="num">
              {p.i}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

export function ResultadoPorOperacao({
  trades,
  mlpt,
  moedaConta,
  largura = 1100,
}: {
  trades: { resultado: number; data: string }[];
  mlpt: number;
  moedaConta: Moeda;
  largura?: number;
}) {
  if (trades.length === 0) return <Vazio texto="Cada barra é um trade. Registre o primeiro." />;

  const simbolo = simboloDaMoeda(moedaConta);

  const valores = trades.map((t) => t.resultado);
  const { min, max } = escala([...valores, mlpt, -mlpt]);

  const y = (v: number) => BASE - ((v - min) / (max - min)) * (BASE - TOPO);
  const faixa = (largura - ESQ - DIR) / trades.length;
  const espessura = Math.max(2.5, Math.min(14, faixa - 4));
  const passo = passoDoEixoX(trades.length);

  return (
    <div>
      <Legenda
        itens={[
          { cor: "var(--gain)", texto: "Gain" },
          { cor: "var(--loss)", texto: "Loss" },
          { cor: "var(--ref)", texto: `Limite MLPT ${moeda(mlpt, moedaConta)}`, tracejado: true },
        ]}
      />
      <svg viewBox={`0 0 ${largura} ${ALTURA}`} className="block h-auto w-full" role="img" aria-label="Resultado por operação">
        {marcasDoEixo(min, max).map((v, i) => (
          <g key={i}>
            <line x1={ESQ} y1={y(v)} x2={largura - DIR} y2={y(v)} stroke="var(--line-soft)" strokeWidth="1" />
            <text x={ESQ - 8} y={y(v) + 4} textAnchor="end" fontSize="11.5" fill="var(--ink-4)" className="num">
              {curto(v, simbolo)}
            </text>
          </g>
        ))}

        <line x1={ESQ} y1={y(0)} x2={largura - DIR} y2={y(0)} stroke="var(--ink-4)" strokeWidth="1.2" strokeDasharray="4 4" />

        {/* Os dois lados do MLPT: mostra se cada trade coube no risco aceito. */}
        {[mlpt, -mlpt].map((v) => (
          <line key={v} x1={ESQ} y1={y(v)} x2={largura - DIR} y2={y(v)} stroke="var(--ref)" strokeWidth="1.4" strokeDasharray="5 4" opacity="0.85" />
        ))}

        {trades.map((t, i) => {
          const acima = t.resultado >= 0;
          const topo = acima ? y(t.resultado) : y(0);
          const alto = Math.max(1.5, Math.abs(y(t.resultado) - y(0)));
          return (
            <rect
              key={i}
              x={ESQ + i * faixa + (faixa - espessura) / 2}
              y={topo}
              width={espessura}
              height={alto}
              rx="2.5"
              fill={t.resultado > 0 ? "var(--gain)" : t.resultado < 0 ? "var(--loss)" : "var(--neutral)"}
            >
              <title>{`#${i + 1} · ${t.data} · ${moeda(t.resultado, moedaConta, true)}`}</title>
            </rect>
          );
        })}

        {trades.map((_, i) =>
          i % passo === 0 || i === trades.length - 1 ? (
            <text key={`x${i}`} x={ESQ + i * faixa + faixa / 2} y={EIXO_X} textAnchor="middle" fontSize="11" fill="var(--ink-4)" className="num">
              {i + 1}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
