"use client";

import { useEffect, useRef, useState } from "react";

import { Secao } from "./secao";

type Tema = "dark" | "light";

/** Resultados de doze operações. A leitura só funciona se ganho e perda se separam. */
const RESULTADOS = [128, -92, 164, 96, -140, 71, -88, 152, 118, -104, 186, 94];
const MAIOR = Math.max(...RESULTADOS.map(Math.abs));

/** Par de mesma luminosidade (L* 58 nos dois) — o erro que a paleta do AION evita. */
const EQUILUMINANTE = { ganho: "#4B9C51", perda: "#DE6668" };

function Barras({ ganho, perda }: { ganho: string; perda: string }) {
  return (
    <div className="flex h-[74px] items-center gap-[5px]">
      {RESULTADOS.map((r, i) => (
        <div key={i} className="flex h-full flex-1 flex-col justify-center">
          <div className="flex h-1/2 items-end">
            {r > 0 ? (
              <span
                className="w-full rounded-t-[2px]"
                style={{ height: `${(r / MAIOR) * 100}%`, background: ganho }}
              />
            ) : null}
          </div>
          <div className="flex h-1/2 items-start">
            {r < 0 ? (
              <span
                className="w-full rounded-b-[2px]"
                style={{ height: `${(-r / MAIOR) * 100}%`, background: perda }}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function Amostra({
  titulo,
  nota,
  ganho,
  perda,
  deNormal,
  deSimulado,
  alerta,
}: {
  titulo: string;
  nota: string;
  ganho: string;
  perda: string;
  deNormal: string;
  deSimulado: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-[13px] border border-line bg-card p-6">
      <h3 className="display text-[17px]">{titulo}</h3>
      <p className="mt-2 max-w-[46ch] text-[13.5px] leading-[1.6] text-ink-3">{nota}</p>

      <div className="mt-6 rounded-[10px] bg-well px-4 py-3">
        <Barras ganho={ganho} perda={perda} />
      </div>

      <p className="mt-5 text-[12px] text-ink-4">O mesmo gráfico, com deuteranopia</p>
      <div
        className="mt-2 rounded-[10px] bg-well px-4 py-3"
        style={{ filter: "url(#apr-deuteranopia)" }}
      >
        <Barras ganho={ganho} perda={perda} />
      </div>

      <p className="num mt-5 border-t border-line-soft pt-4 text-[12.5px] text-ink-3">
        ΔE {deNormal}
        <span className="mx-2 text-ink-4">cai para</span>
        <span className={alerta ? "text-loss" : "text-gain"}>{deSimulado}</span>
      </p>
    </div>
  );
}

export function Paleta() {
  // O script do layout já pintou a tela antes deste componente existir. Aqui o
  // estado começa em null para não discordar do HTML vindo do servidor, que é
  // sempre escuro, e sincroniza depois do mount.
  const [tema, setTema] = useState<Tema | null>(null);
  const escolhido = useRef(false);

  useEffect(() => {
    const atual = document.documentElement.dataset.theme;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver comentário acima
    setTema(atual === "light" ? "light" : "dark");
  }, []);

  // A troca de tema é uma mutação fora do React, então mora num efeito e não no
  // clique. Só grava a preferência quando veio de um clique: sincronizar o
  // estado no mount não pode transformar o palpite do sistema em escolha.
  useEffect(() => {
    if (tema === null) return;
    document.documentElement.dataset.theme = tema;
    if (!escolhido.current) return;
    try {
      localStorage.setItem("aion-tema", tema);
    } catch {
      // navegação privada: o tema vale só para esta aba
    }
  }, [tema]);

  function trocar(novo: Tema) {
    escolhido.current = true;
    setTema(novo);
  }

  const temaVisivel: Tema = tema ?? "dark";

  return (
    <Secao
      id="paleta"
      titulo="Ganho e perda não podem depender do matiz"
      abertura={
        <>
          Cerca de 8% dos homens têm alguma deficiência na visão de vermelho e verde. Um
          par de verde e vermelho na mesma luminosidade é a escolha instintiva para
          dinheiro, e é justamente o par que se fecha para eles. No AION a distância entre ganho e perda está na
          luminosidade, e por isso sobrevive à simulação. Troque o tema: a página inteira
          muda com você.
        </>
      }
    >
      {/* Viénot, Brettel & Mollon (1999), deuteranopia. Opera em RGB linear —
          por isso nada de color-interpolation-filters="sRGB" aqui. */}
      <svg width="0" height="0" aria-hidden className="absolute">
        <filter id="apr-deuteranopia">
          <feColorMatrix
            type="matrix"
            values="0.29275 0.70725 0 0 0
                    0.29275 0.70725 0 0 0
                    -0.02234 0.02234 1 0 0
                    0 0 0 1 0"
          />
        </filter>
      </svg>

      <div className="mb-8 flex items-center gap-3">
        <div
          role="group"
          aria-label="Tema da página"
          className="flex gap-1 rounded-[10px] border border-line-strong bg-input p-1"
        >
          {(["dark", "light"] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => trocar(opcao)}
              aria-pressed={temaVisivel === opcao}
              className={`rounded-[7px] px-[15px] py-[7px] text-[13px] ${
                temaVisivel === opcao ? "bg-accent text-accent-ink" : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {opcao === "dark" ? "Escuro" : "Claro"}
            </button>
          ))}
        </div>
        <span className="text-[13px] text-ink-4">
          {temaVisivel === "dark" ? "carvão quente" : "papel quente"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Amostra
          titulo="Verde e vermelho de mesma luminosidade"
          nota="Separados só pelo matiz, com L* 58 nos dois. Legível para quase todo mundo, e quase invisível para quem tem deuteranopia."
          ganho={EQUILUMINANTE.ganho}
          perda={EQUILUMINANTE.perda}
          deNormal="88,5"
          deSimulado="5,2"
          alerta
        />
        <Amostra
          titulo="A paleta do AION"
          nota={
            temaVisivel === "dark"
              ? "Menta clara contra rosa fundo: 29 pontos de luminosidade separam os dois antes de qualquer matiz entrar na conta."
              : "No claro a relação inverte, verde fundo contra vermelho claro, porque sobre papel quente o mesmo par de luminosidades não funcionaria."
          }
          ganho="var(--gain)"
          perda="var(--loss)"
          deNormal={temaVisivel === "dark" ? "92,3" : "90,5"}
          deSimulado={temaVisivel === "dark" ? "26,0" : "38,6"}
        />
      </div>

      <p className="mt-6 max-w-[74ch] text-[13px] leading-[1.65] text-ink-4">
        ΔE calculado em CIE L*a*b* sobre a simulação de Viénot, Brettel e Mollon — a mesma
        que roda no filtro acima. A regra que a especificação do projeto fixa é esta: cor
        de ganho ou perda só muda depois de passar por um simulador, nunca no olho.
      </p>
    </Secao>
  );
}
