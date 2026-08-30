"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Arco, Marca } from "@/components/marca";
import { AlternadorDeTema } from "@/components/tema";

const CHAVE_RECOLHIDA = "aion-menu-recolhido";

const ITENS = [
  { href: "/conta", rotulo: "Conta", icone: <><path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h9A1.5 1.5 0 0 1 14 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5z" /><path d="M2 6.8h12" /><circle cx="11" cy="10.4" r="0.9" /></> },
  { href: "/setup", rotulo: "Setup", icone: <><path d="M8 2l6 3-6 3-6-3 6-3z" /><path d="M2 8l6 3 6-3" /><path d="M2 11.2l6 3 6-3" /></> },
  { href: "/plano", rotulo: "Plano", icone: <><path d="M4.6 2.4h6.8A1.5 1.5 0 0 1 12.9 3.9v8.2a1.5 1.5 0 0 1-1.5 1.5H4.6a1.5 1.5 0 0 1-1.5-1.5V3.9a1.5 1.5 0 0 1 1.5-1.5z" /><path d="M5.8 6h4.4M5.8 8.6h4.4M5.8 11.2h2.6" /></> },
  { href: "/backteste", rotulo: "Backteste", icone: <><path d="M6 2v4.2L2.7 12A1.4 1.4 0 0 0 3.9 14h8.2a1.4 1.4 0 0 0 1.2-2L10 6.2V2" /><path d="M5 2h6" /><path d="M4.7 10.2h6.6" /></> },
  { href: "/perfomance", rotulo: "Perfomance", icone: <><path d="M2 11l4-4 3 3 5-5" /><path d="M10 5h4v4" /></> },
  { href: "/estudos", rotulo: "Estudos", icone: <><rect x="2" y="3" width="12" height="10" rx="1.6" /><path d="M2 10.6l3.2-3.2 2.6 2.6 2-2L14 11.2" /><circle cx="10.4" cy="5.9" r="1" /></> },
];

export function BarraLateral({ sair }: { sair: () => Promise<void> }) {
  const caminho = usePathname();
  const [recolhida, setRecolhida] = useState(false);

  // Igual ao tema: o servidor não conhece o localStorage, então o padrão SSR-safe
  // é "expandida" e a correção acontece depois do mount, para não gerar erro de
  // hidratação lendo localStorage direto no useState.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ver comentário acima
      setRecolhida(localStorage.getItem(CHAVE_RECOLHIDA) === "1");
    } catch {
      // navegação privada: fica sempre expandida
    }
  }, []);

  function alternar() {
    setRecolhida((atual) => {
      const novo = !atual;
      try {
        localStorage.setItem(CHAVE_RECOLHIDA, novo ? "1" : "0");
      } catch {
        // navegação privada: a preferência vale só para esta sessão
      }
      return novo;
    });
  }

  return (
    <aside
      className={
        "flex shrink-0 flex-col border-r border-line-soft bg-tint py-6 transition-[width] duration-150 " +
        (recolhida ? "w-[68px] px-[10px]" : "w-[236px] px-[14px]")
      }
    >
      <div
        className={
          "flex pb-[26px] pt-0.5 " +
          (recolhida ? "flex-col items-center gap-[10px] px-0" : "items-center justify-between px-[10px]")
        }
      >
        {recolhida ? <Arco tamanho={22} /> : <Marca />}

        <button
          type="button"
          onClick={alternar}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
          className="flex shrink-0 items-center justify-center rounded-lg p-[7px] text-ink-4 hover:bg-raised hover:text-ink-2"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="shrink-0"
          >
            <rect x="2" y="2.5" width="12" height="11" rx="1.8" />
            <path d="M6.4 2.5v11" />
            {recolhida ? <path d="M9.6 5.6l2 2.4-2 2.4" /> : <path d="M9.6 5.6l-2 2.4 2 2.4" />}
          </svg>
        </button>
      </div>

      <nav className="flex flex-col gap-[3px]">
        {ITENS.map((item) => {
          const ativo = caminho.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              title={recolhida ? item.rotulo : undefined}
              className={
                "flex items-center gap-[11px] rounded-lg py-[10px] font-medium " +
                (recolhida ? "justify-center px-0" : "px-[11px]") +
                " " +
                (ativo
                  ? "bg-accent font-semibold text-accent-ink"
                  : "text-ink-3 hover:bg-raised hover:text-ink-2")
              }
            >
              <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                {item.icone}
              </svg>
              {!recolhida && item.rotulo}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-[3px] border-t border-line-soft pt-4">
        <AlternadorDeTema compacto={recolhida} />
        <form action={sair}>
          <button
            type="submit"
            title={recolhida ? "Sair" : undefined}
            className={
              "flex w-full items-center gap-[11px] rounded-lg py-[10px] font-medium text-ink-3 hover:bg-raised hover:text-ink-2 " +
              (recolhida ? "justify-center px-0" : "px-[11px]")
            }
          >
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
              <path d="M6.4 13.6H3.9a1.5 1.5 0 0 1-1.5-1.5V3.9a1.5 1.5 0 0 1 1.5-1.5h2.5" />
              <path d="M10.6 11.2L13.8 8l-3.2-3.2" />
              <path d="M13.8 8H6.2" />
            </svg>
            {!recolhida && "Sair"}
          </button>
        </form>
      </div>
    </aside>
  );
}
