import { BarraLateral } from "@/components/barra-lateral";

import { sair } from "../login/acoes";

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
