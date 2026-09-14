/**
 * A moldura de todas as seções. Título à esquerda, texto de abertura à direita,
 * e uma régua fina fechando o par — a mesma divisão em duas colunas que é o
 * assunto do app.
 */
export function Secao({
  id,
  titulo,
  abertura,
  children,
}: {
  id?: string;
  titulo: string;
  abertura?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-b border-line-soft py-[86px]">
      <div className="mx-auto max-w-[1180px] px-6 sm:px-8">
        <div className="grid gap-6 border-b border-line pb-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,9fr)] lg:gap-16">
          <h2 className="display text-[clamp(25px,2.8vw,34px)] leading-[1.12]">{titulo}</h2>
          {abertura ? (
            <p className="max-w-[62ch] text-[15.5px] leading-[1.65] text-ink-2">{abertura}</p>
          ) : null}
        </div>
        <div className="mt-11">{children}</div>
      </div>
    </section>
  );
}

/** Legenda de uma tela recriada. */
export function Legenda({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-[18px] grid gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(0,9fr)] lg:gap-16">
      <h3 className="display text-[18px] leading-snug text-ink">{titulo}</h3>
      <p className="max-w-[62ch] text-[14px] leading-[1.62] text-ink-3">{children}</p>
    </div>
  );
}
