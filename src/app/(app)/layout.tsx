import { BarraLateral } from "@/components/barra-lateral";

import { sair } from "../login/acoes";

/**
 * Nada aqui pode ser pré-renderizado: toda página depende do usuário logado.
 * Sem isto, o build tenta gerar as telas sem sessão e falha na Vercel.
 */
export const dynamic = "force-dynamic";

export default function LayoutAplicacao({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <BarraLateral sair={sair} />
      <main className="min-w-0 flex-1 px-[30px] py-[26px]">{children}</main>
    </div>
  );
}
