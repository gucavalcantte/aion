"use server";

import { redirect } from "next/navigation";

import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoLogin = { erro?: string };

export async function entrar(
  _anterior: EstadoLogin,
  dados: FormData,
): Promise<EstadoLogin> {
  const email = String(dados.get("email") ?? "").trim();
  const senha = String(dados.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Preencha e-mail e senha." };
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    // Mensagem única de propósito: dizer qual dos dois está errado entrega
    // quais e-mails existem.
    return { erro: "E-mail ou senha incorretos." };
  }

  redirect("/perfomance");
}

export async function sair() {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
