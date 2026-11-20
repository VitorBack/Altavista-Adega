import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Bairro, Produto } from "./catalogo";

export function supabaseServidor() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY;

  if (!url || !chave) throw new Error("Supabase sem configuração");

  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

export async function carregarLoja() {
  const supabase = supabaseServidor();
  const [produtos, bairros] = await Promise.all([
    supabase.from("produtos")
      .select("id,nome,categoria,volume,imagem_url,varejo_centavos,atacado_centavos,minimo_atacado,mais_vendido,oferta_da_semana")
      .eq("ativo", true).order("ordem").order("nome").returns<Produto[]>(),
    supabase.from("bairros").select("id,nome,frete_centavos")
      .eq("atendido", true).order("nome").returns<Bairro[]>(),
  ]);

  if (produtos.error || bairros.error) throw new Error("Falha ao carregar a loja");

  return { produtos: produtos.data, bairros: bairros.data };
}
