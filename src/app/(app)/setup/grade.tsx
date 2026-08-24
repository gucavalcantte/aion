"use client";

import Link from "next/link";
import { useState } from "react";

import { BotaoRemover } from "@/components/botao-remover";

import type { Estatistica, SetupComEstatistica } from "@/lib/dados/setups";
import { emR, inteiro, percentual, VAZIO } from "@/lib/formato";

import { removerSetup, reordenarSetups } from "./acoes";

/** Abaixo disso a estatística real não diz nada — melhor avisar que enfeitar. */
const AMOSTRA_CURTA = 20;

export function GradeDeSetups({ setups }: { setups: SetupComEstatistica[] }) {
  const [ordem, setOrdem] = useState(setups);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<{ src: string; nome: string } | null>(null);

  function soltarSobre(alvo: string) {
    if (!arrastando || arrastando === alvo) return;
    const nova = [...ordem];
    const de = nova.findIndex((s) => s.id === arrastando);
    const para = nova.findIndex((s) => s.id === alvo);
    const [item] = nova.splice(de, 1);
    nova.splice(para, 0, item);
    setOrdem(nova);
    void reordenarSetups(nova.map((s) => s.id));
  }

  return (
    <>
    <div className="grid grid-cols-3 gap-4">
      {ordem.map((setup) => (
        <article
          key={setup.id}
          draggable
          onDragStart={() => setArrastando(setup.id)}
          onDragEnd={() => setArrastando(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => soltarSobre(setup.id)}
          className={
            "flex flex-col overflow-hidden rounded-xl border bg-card transition-opacity " +
            (arrastando === setup.id ? "border-accent opacity-40" : "border-line")
          }
        >
          <div className="relative flex h-[186px] items-center justify-center border-b border-line-soft bg-well p-2">
            {setup.imagem ? (
              <button
                type="button"
                onClick={() => setAmpliada({ src: setup.imagem!, nome: setup.nome })}
                aria-label={`Ampliar imagem de ${setup.nome}`}
                className="group relative size-full"
              >
                {/* object-contain, não cover: em print de gráfico o corte come
                    metade do padrão, que é justamente o que se quer ver. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.imagem} alt="" className="size-full rounded-md object-contain" />
                <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                  <svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7.2" cy="7.2" r="4.6" /><path d="M10.6 10.6L14 14M7.2 5.4v3.6M5.4 7.2h3.6" />
                  </svg>
                </span>
              </button>
            ) : (
              <span className="text-[13px] text-ink-4">sem imagem</span>
            )}
            <span className="absolute left-[11px] top-[11px] cursor-grab text-ink-4" aria-hidden>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5.5" cy="3" r="1.3" /><circle cx="10.5" cy="3" r="1.3" />
                <circle cx="5.5" cy="8" r="1.3" /><circle cx="10.5" cy="8" r="1.3" />
                <circle cx="5.5" cy="13" r="1.3" /><circle cx="10.5" cy="13" r="1.3" />
              </svg>
            </span>
          </div>

          <div className="flex flex-1 flex-col p-[19px] pt-[17px]">
            <div className="flex items-start justify-between gap-3">
              <h2 className="display text-[20px] leading-[1.15]">{setup.nome}</h2>
              <div className="flex gap-[9px] pt-[5px] text-ink-4">
                <Link href={`/setup/${setup.id}`} aria-label={`Editar ${setup.nome}`} className="text-ink-4 hover:text-ink-2">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.3 2.7a1.6 1.6 0 0 1 2.3 2.3L5.5 13 2 14l1-3.5z" />
                  </svg>
                </Link>
                <BotaoRemover
                  acao={removerSetup}
                  campos={{ id: setup.id }}
                  rotulo={`Remover ${setup.nome}`}
                  titulo={`Remover o setup ${setup.nome}?`}
                  descricao="O setup sai da lista e da tela de Plano, junto com a imagem de referência."
                  aviso="Se houver backtestes ou trades apontando para ele, o banco bloqueia a remoção."
                />
              </div>
            </div>

            <p className="mt-2 line-clamp-2 min-h-[42px] text-[13.5px] leading-[1.55] text-ink-3">
              {setup.descricao || "sem descrição"}
            </p>

            <div className="mt-4 border-t border-line pt-1">
              <Linha titulo="Backteste" cor="text-ink-3" barra="bg-ink-3" dados={setup.backteste} />
              <Linha
                titulo="Real"
                cor={setup.real.registros === 0 ? "text-ink-4" : "text-accent-soft"}
                barra="bg-accent-soft"
                dados={setup.real}
              />
              <Delta setup={setup} />
            </div>
          </div>
        </article>
      ))}
    </div>

    {ampliada && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Imagem de ${ampliada.nome}`}
        onClick={() => setAmpliada(null)}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-8"
      >
        <p className="display text-[19px] text-white">{ampliada.nome}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ampliada.src}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
        />
        <p className="text-[13.5px] text-white/60">clique fora para fechar</p>
      </div>
    )}
    </>
  );
}

function Linha({
  titulo,
  cor,
  barra,
  dados,
}: {
  titulo: string;
  cor: string;
  barra: string;
  dados: Estatistica;
}) {
  return (
    <div className="grid grid-cols-[78px_1fr_62px_46px] items-center gap-[10px] py-[9px]">
      <span className={`text-[10.5px] font-bold uppercase tracking-[0.10em] ${cor}`}>{titulo}</span>
      <span className="h-[6px] overflow-hidden rounded-[3px] bg-black/25">
        {dados.assertividade !== null && (
          <span className={`block h-full rounded-[3px] ${barra}`} style={{ width: `${dados.assertividade}%` }} />
        )}
      </span>
      <span className="num text-right text-[15px] font-semibold">
        {dados.assertividade === null ? (
          <span className="text-ink-4">{VAZIO}</span>
        ) : (
          <>
            {percentual(dados.assertividade, 0).replace("%", "")}
            <span className="text-[11.5px] text-ink-3">%</span>
          </>
        )}
      </span>
      <span className="num text-right text-[12.5px] text-ink-4">{inteiro(dados.registros)}</span>
    </div>
  );
}

function Delta({ setup }: { setup: SetupComEstatistica }) {
  let texto: string;
  let classe = "bg-black/25 text-ink-3";

  if (setup.real.registros === 0) {
    texto = "nunca operado";
  } else if (setup.real.registros < AMOSTRA_CURTA) {
    texto = "amostra pequena";
  } else if (setup.delta === null) {
    texto = VAZIO;
  } else if (setup.delta <= -5) {
    texto = `↓ ${Math.abs(Math.round(setup.delta))} pp abaixo do estudo`;
    classe = "bg-loss-bg text-loss";
  } else if (setup.delta >= 5) {
    texto = `↑ ${Math.round(setup.delta)} pp acima do estudo`;
    classe = "bg-gain-bg text-gain";
  } else {
    texto = "≈ fiel ao estudo";
  }

  return (
    <div className="mt-2.5 flex items-center justify-between">
      <span className={`inline-flex h-[23px] items-center rounded-md px-[9px] text-[12.5px] font-semibold ${classe}`}>
        {texto}
      </span>
      <span className="num text-[13px] text-ink-3">
        {emR(setup.backteste.riscoRetorno)} → {emR(setup.real.riscoRetorno)}
      </span>
    </div>
  );
}
