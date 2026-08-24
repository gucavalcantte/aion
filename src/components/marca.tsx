/** O arco com seta é o ciclo do nome. Sempre no acento claro. */
export function Arco({ tamanho = 22 }: { tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 16 16"
      fill="none"
      stroke="var(--accent-soft)"
      strokeWidth={tamanho > 32 ? 1.25 : 1.45}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13.6 8a5.6 5.6 0 1 1-1.95-4.25" />
      <path d="M13.8 2.3v3.3h-3.3" />
    </svg>
  );
}

export function Marca({
  tamanho = 22,
  corpo = 19,
  espaco = "0.20em",
}: {
  tamanho?: number;
  corpo?: number;
  espaco?: string;
}) {
  return (
    <span className="flex items-center gap-[11px]">
      <Arco tamanho={tamanho} />
      <span
        className="display"
        style={{
          fontSize: corpo,
          letterSpacing: espaco,
          paddingLeft: espaco,
          lineHeight: 1,
        }}
      >
        AION
      </span>
    </span>
  );
}
