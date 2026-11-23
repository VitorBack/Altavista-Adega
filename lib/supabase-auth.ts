import "server-only";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { cookies } from "next/headers";

type Perfil = {
  nome_usuario: string;
  data_nascimento: string;
};

export function criarClienteSessao(cookies: CookieMethodsServer) {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !chave) return null;

  return createServerClient(url, chave, {
    cookies,
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

export async function supabaseSessao(gravarCookies = false) {
  const armazenamento = await cookies();
  return criarClienteSessao({
    getAll: () => armazenamento.getAll(),
    setAll: (alteracoes) => {
      if (!gravarCookies) return; // O proxy renova a sessão durante a navegação.
      for (const { name, value, options } of alteracoes) armazenamento.set(name, value, options);
    },
  });
}

export function consultarPerfil(supabase: NonNullable<ReturnType<typeof criarClienteSessao>>, usuarioId: string) {
  return supabase.from("perfis").select("nome_usuario,data_nascimento")
    .eq("usuario_id", usuarioId).maybeSingle<Perfil>();
}

export async function carregarConta(supabase: NonNullable<ReturnType<typeof criarClienteSessao>>) {
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return null;

  const { data: perfil, error } = await consultarPerfil(supabase, data.claims.sub);
  return {
    email: typeof data.claims.email === "string" ? data.claims.email : undefined,
    perfil,
    erroPerfil: Boolean(error),
  };
}
