import "server-only";

import { clienteServidor } from "./supabase/servidor";

const BUCKET = "imagens";
const TAMANHO_MAXIMO = 8 * 1024 * 1024;
const TIPOS = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];

/** Caminho é sempre <user_id>/<pasta>/<arquivo> — é assim que a policy isola. */
export async function enviarImagem(
  arquivo: File,
  pasta: "setups" | "trades" | "estudos",
): Promise<{ caminho?: string; erro?: string }> {
  if (arquivo.size === 0) return {};
  if (arquivo.size > TAMANHO_MAXIMO) {
    return { erro: "Imagem acima de 8 MB. Reduza antes de enviar." };
  }
  if (!TIPOS.includes(arquivo.type)) {
    return { erro: "Formato não aceito. Use PNG, JPG, WebP, GIF ou AVIF." };
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada." };

  const extensao = arquivo.name.split(".").pop()?.toLowerCase() || "png";
  const caminho = `${user.id}/${pasta}/${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    contentType: arquivo.type,
    upsert: false,
  });
  if (error) return { erro: error.message };

  return { caminho };
}

export async function removerImagem(caminho: string | null | undefined) {
  if (!caminho) return;
  const supabase = await clienteServidor();
  await supabase.storage.from(BUCKET).remove([caminho]);
}

/**
 * O bucket é privado, então a imagem só abre por URL assinada.
 * Uma hora é bastante para uma sessão de estudo.
 */
export async function urlAssinada(caminho: string | null | undefined) {
  if (!caminho) return null;
  const supabase = await clienteServidor();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 3600);
  return data?.signedUrl ?? null;
}

export async function urlsAssinadas(caminhos: (string | null)[]) {
  const validos = caminhos.filter((c): c is string => Boolean(c));
  if (validos.length === 0) return new Map<string, string>();

  const supabase = await clienteServidor();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(validos, 3600);

  const mapa = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) mapa.set(item.path, item.signedUrl);
  }
  return mapa;
}
