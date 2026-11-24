import type { ComponentProps } from "react";

/**
 * <select> com seta visível. O estilo do app usa `appearance-none` para
 * controlar a borda e o fundo, mas isso também some com a seta nativa — e o
 * campo deixa de parecer uma lista. Aqui a seta volta como um ícone sobre o
 * campo, na cor do tema (claro e escuro).
 *
 * Responsivo: o contêiner ocupa a largura da coluna (`w-full`, `min-w-0`), então
 * acompanha grids e telas estreitas; opções compridas são cortadas com
 * reticências em vez de empurrar o layout, e o recuo à direita reserva o lugar
 * da seta. Passe em `className` o mesmo estilo do campo de antes (altura, borda,
 * fundo); `appearance-none`, cursor e recuo já vêm daqui.
 */
export function SelectComSeta({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block w-full min-w-0">
      <select {...props} className={`${className} w-full cursor-pointer appearance-none truncate !pr-8`}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3.5 6l4.5 4.5L12.5 6" />
      </svg>
    </span>
  );
}
