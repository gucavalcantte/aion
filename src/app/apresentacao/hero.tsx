import { Marca } from "@/components/marca";

/**
 * A divergência entre estudo e execução é a tese do app, então abre a página.
 * As três linhas montam em sequência e a diferença resolve por último — é o
 * único momento coreografado da apresentação.
 */
function LinhaSerie({
  rotulo,
  assertividade,
  riscoRetorno,
  amostra,
  atraso,
  tom,
}: {
  rotulo: string;
  assertividade: string;
  riscoRetorno: string;
  amostra: string;
  atraso: number;
  tom: "estudo" | "real";
}) {
  return (
    <div
      className="apr-entra grid grid-cols-3 items-baseline gap-x-5 gap-y-[10px] py-[18px] sm:grid-cols-[96px_1fr_auto_auto] sm:gap-x-6 sm:gap-y-0"
      style={{ animationDelay: `${atraso}ms` }}
    >
      {/* No celular o rótulo fica sozinho na primeira linha e os três números
          alinham embaixo; a partir de sm tudo cabe numa linha só. */}
      <dt className="col-span-3 text-[14.5px] text-ink-3 sm:col-span-1">{rotulo}</dt>
      <dd
        className={`num text-[30px] leading-none sm:text-right ${
          tom === "estudo" ? "text-ink" : "text-ink-2"
        }`}
      >
        {assertividade}
      </dd>
      <dd className="num text-[19px] leading-none text-ink-2 sm:min-w-[62px] sm:text-right">
        {riscoRetorno}
      </dd>
      <dd className="num text-right text-[13px] leading-none text-ink-4 sm:min-w-[104px]">
        {amostra}
      </dd>
    </div>
  );
}

function CartaoDivergencia() {
  return (
    <figure
      className="apr-entra relative rounded-[18px] border border-line bg-card p-7 shadow-[0_36px_80px_-46px_rgba(0,0,0,0.92)]"
      style={{ animationDelay: "260ms" }}
    >
      <figcaption className="flex items-baseline justify-between border-b border-line-soft pb-5">
        <span className="display text-[20px]">CEB</span>
        <span className="text-[12.5px] text-ink-4">o mesmo setup, medido duas vezes</span>
      </figcaption>

      <dl className="divide-y divide-line-soft">
        <LinhaSerie
          rotulo="Backteste"
          assertividade="68%"
          riscoRetorno="1,8R"
          amostra="142 registros"
          atraso={420}
          tom="estudo"
        />
        <LinhaSerie
          rotulo="Real"
          assertividade="54%"
          riscoRetorno="1,2R"
          amostra="23 trades"
          atraso={560}
          tom="real"
        />
      </dl>

      <div
        className="apr-entra mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 rounded-[11px] bg-well px-4 py-[14px]"
        style={{ animationDelay: "820ms" }}
      >
        <span className="text-[13px] text-ink-3">o que a execução não entregou</span>
        <span className="num whitespace-nowrap text-[15px] text-loss">−14 pts &nbsp;−0,6R</span>
      </div>
    </figure>
  );
}

export function Hero() {
  return (
    <header className="relative overflow-hidden border-b border-line-soft">
      {/* a marca ampliada, quase invisível — mesma linguagem da tela de entrada */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden
        className="pointer-events-none absolute -left-[300px] -top-[340px] size-[1100px] opacity-[0.06]"
      >
        <path
          d="M88 50a38 38 0 1 1-13.2-28.8"
          stroke="var(--accent-soft)"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path
          d="M89.4 12v18h-18"
          stroke="var(--accent-soft)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden
        className="pointer-events-none absolute -bottom-[420px] right-[-220px] size-[860px] opacity-[0.055]"
      >
        <circle cx="50" cy="50" r="40" stroke="var(--accent)" strokeWidth="1.6" />
        <circle cx="50" cy="50" r="29" stroke="var(--accent)" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="18" stroke="var(--accent)" strokeWidth="0.9" />
      </svg>

      <div className="relative mx-auto max-w-[1180px] px-6 sm:px-8">
        <div
          className="apr-entra flex items-center justify-between gap-4 pt-[34px] text-ink"
          style={{ animationDelay: "60ms" }}
        >
          <Marca tamanho={24} corpo={20} />

          <a
            href="/login"
            className="flex h-9 shrink-0 items-center rounded-[8px] border border-line-strong px-4 text-[13.5px] font-medium text-ink-2 transition-colors hover:border-accent-soft hover:text-ink"
          >
            Entrar
          </a>
        </div>

        <div className="grid grid-cols-1 items-center gap-14 py-[58px] lg:grid-cols-[1fr_450px] lg:gap-20 lg:py-[80px]">
          <div>
            <h1
              className="apr-entra display text-[clamp(36px,5.2vw,60px)] leading-[1.03]"
              style={{ animationDelay: "140ms" }}
            >
              O que você estudou não é o que você executou.
            </h1>

            <p
              className="apr-entra mt-7 max-w-[50ch] text-[17px] leading-[1.62] text-ink-2"
              style={{ animationDelay: "200ms" }}
            >
              O AION guarda o backteste e a operação real como duas séries que nunca se
              somam, calcula a estatística de cada uma e mostra, setup por setup, onde a
              execução deixou de entregar o que o estudo prometia.
            </p>

            <p
              className="apr-entra mt-9 max-w-[46ch] text-[13.5px] leading-[1.7] text-ink-3"
              style={{ animationDelay: "260ms" }}
            >
              Next.js 16 e TypeScript no App Router, Postgres e Auth no Supabase, Tailwind
              para o sistema visual, hospedado na Vercel.
            </p>
          </div>

          <CartaoDivergencia />
        </div>
      </div>
    </header>
  );
}
