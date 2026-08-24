import { carregarPlano } from "@/lib/dados/plano";

import { FormularioPlano } from "./formulario";

export const metadata = { title: "Editar plano — AION" };

export default async function PaginaEditarPlano() {
  const { plano, conta } = await carregarPlano();
  return <FormularioPlano plano={plano} conta={conta} />;
}
