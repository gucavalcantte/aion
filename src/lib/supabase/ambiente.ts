/**
 * As variáveis não têm prefixo NEXT_PUBLIC_ de propósito: a chave nunca vai
 * para o bundle do navegador. Todo acesso a dados acontece no servidor —
 * Server Components, Server Actions e middleware.
 */

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `Falta ${nome} no .env.local. Copie de .env.local.example e preencha com ` +
        `os valores do painel do Supabase (Settings > API Keys).`,
    );
  }
  return valor;
}

export function credenciaisSupabase() {
  return {
    url: obrigatoria("SUPABASE_URL"),
    chave: obrigatoria("SUPABASE_PUBLISHABLE_KEY"),
  };
}
