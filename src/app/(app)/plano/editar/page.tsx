import { listarAtivos } from "@/lib/dados/ativos";
import { carregarPlano } from "@/lib/dados/plano";

import { FormularioPlano } from "./formulario";

export const metadata = { title: "Editar plano — AION" };

export default async function PaginaEditarPlano() {
  const [{ plano, conta }, ativos] = await Promise.all([carregarPlano(), listarAtivos()]);
  return <FormularioPlano plano={plano} conta={conta} ativos={ativos} />;
}
