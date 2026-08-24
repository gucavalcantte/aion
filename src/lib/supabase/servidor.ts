import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { credenciaisSupabase } from "./ambiente";

/**
 * Cliente para Server Components e Server Actions.
 * Roda como o usuário logado, via cookie de sessão.
 */
export async function clienteServidor() {
  const { url, chave } = credenciaisSupabase();
  const cookieStore = await cookies();

  return createServerClient(url, chave, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(paraGravar) {
        try {
          for (const { name, value, options } of paraGravar) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component não pode gravar cookie. O middleware já renova a
          // sessão a cada request, então dá para ignorar com segurança.
        }
      },
    },
  });
}

/** O usuário da sessão, ou null. Sempre via getUser() — nunca getSession(),
 *  que lê o cookie sem validar no servidor de auth. */
export async function usuarioAtual() {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
