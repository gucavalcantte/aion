"use client";

import { useEffect, useState } from "react";

type Tema = "dark" | "light";

export function AlternadorDeTema({ compacto = false }: { compacto?: boolean }) {
  const [tema, setTema] = useState<Tema>("dark");

  // O script no layout já pintou a tela antes disto. Aqui só sincronizamos
  // o estado do botão com o que está no <html>.
  useEffect(() => {
    const atual = document.documentElement.dataset.theme;
    if (atual === "light" || atual === "dark") setTema(atual);
  }, []);

  function trocar(novo: Tema) {
    setTema(novo);
    document.documentElement.dataset.theme = novo;
    try {
      localStorage.setItem("aion-tema", novo);
    } catch {
      // navegação privada: o tema vale só para esta aba
    }
  }

  // Recolhida, a barra lateral não tem largura para o par de botões (Escuro/Claro)
  // lado a lado — o grupo estourava a coluna de 68px. Um único botão que alterna
  // segue o mesmo padrão dos outros ícones da barra quando recolhida.
  if (compacto) {
    const proximo: Tema = tema === "dark" ? "light" : "dark";
    return (
      <button
        type="button"
        onClick={() => trocar(proximo)}
        title={proximo === "light" ? "Mudar para tema claro" : "Mudar para tema escuro"}
        aria-label={proximo === "light" ? "Mudar para tema claro" : "Mudar para tema escuro"}
        className="flex w-full items-center justify-center rounded-lg py-[10px] font-medium text-ink-4 hover:bg-raised hover:text-ink-2"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="shrink-0"
        >
          {tema === "dark" ? (
            <path d="M13.4 9.4A5.8 5.8 0 0 1 6.6 2.6a5.8 5.8 0 1 0 6.8 6.8z" />
          ) : (
            <>
              <circle cx="8" cy="8" r="3.1" />
              <path d="M8 1.4v1.6M8 13v1.6M14.6 8H13M3 8H1.4M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4L3.3 3.3" />
            </>
          )}
        </svg>
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between px-[11px] pb-[9px] pt-[5px]">
      <span className="text-[13.5px] text-ink-3">Tema</span>
      <div
        role="group"
        aria-label="Tema"
        className="flex gap-0.5 rounded-lg border border-line-strong bg-input p-0.5"
      >
        <Opcao ativo={tema === "dark"} onClick={() => trocar("dark")} rotulo="Escuro">
          <path d="M13.4 9.4A5.8 5.8 0 0 1 6.6 2.6a5.8 5.8 0 1 0 6.8 6.8z" />
        </Opcao>
        <Opcao ativo={tema === "light"} onClick={() => trocar("light")} rotulo="Claro">
          <circle cx="8" cy="8" r="3.1" />
          <path d="M8 1.4v1.6M8 13v1.6M14.6 8H13M3 8H1.4M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4L3.3 3.3" />
        </Opcao>
      </div>
    </div>
  );
}

function Opcao({
  ativo,
  onClick,
  rotulo,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      aria-pressed={ativo}
      className={
        "flex items-center rounded-md px-[10px] py-[5px] " +
        (ativo ? "bg-accent text-accent-ink" : "text-ink-4 hover:text-ink-3")
      }
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}
