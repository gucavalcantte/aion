import { notFound } from "next/navigation";

import { buscarSetup } from "@/lib/dados/setups";

import { FormularioSetup } from "./formulario";

export const metadata = { title: "Setup — AION" };

export default async function PaginaSetupEdicao({ params }: PageProps<"/setup/[id]">) {
  const { id } = await params;

  if (id === "novo") return <FormularioSetup setup={null} />;

  const setup = await buscarSetup(id);
  if (!setup) notFound();

  return <FormularioSetup setup={setup} />;
}
