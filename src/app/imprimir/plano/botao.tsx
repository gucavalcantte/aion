"use client";

export function BotaoImprimir() {
  return (
    <div className="mx-auto mb-5 flex w-[1123px] items-center justify-between print:hidden">
      <p className="text-[14px] text-white/70">
        A4 paisagem · uma página. Na caixa de impressão, marque{" "}
        <strong className="text-white">Gráficos de fundo</strong> para as faixas saírem.
      </p>
      <button
        type="button"
        onClick={() => window.print()}
        className="flex h-[38px] items-center gap-2 rounded-lg bg-white px-[15px] text-[14.5px] font-semibold text-[#1a1a18]"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4.5 6V2.4h7V6" />
          <rect x="2.4" y="6" width="11.2" height="5" rx="1.4" />
          <path d="M4.5 11h7v2.6h-7z" />
        </svg>
        Imprimir
      </button>
    </div>
  );
}
