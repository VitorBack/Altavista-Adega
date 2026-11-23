import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Loja } from "@/components/loja";
import { Entrada } from "@/components/entrada";
import { COOKIE_MAIORIDADE, comprovanteValido } from "@/lib/maioridade";
import { carregarLoja } from "@/lib/supabase";
import { carregarConta, supabaseSessao } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const { code } = await searchParams;
  // O Supabase pode voltar para a Site URL quando o endereço específico não está autorizado.
  if (typeof code === "string" && code) redirect(`/auth/confirm?${new URLSearchParams({ code })}`);

  const cookie = (await cookies()).get(COOKIE_MAIORIDADE)?.value;
  const supabase = await supabaseSessao();
  if (!comprovanteValido(cookie)) return <Entrada contasDisponiveis={Boolean(supabase)} />;

  const [dados, conta] = await Promise.all([
    carregarLoja().catch(() => null),
    supabase ? carregarConta(supabase).catch(() => null) : null,
  ]);
  const rotuloConta = supabase ? conta?.perfil?.nome_usuario ?? (conta ? "Minha conta" : "Entrar") : null;
  return <Loja produtos={dados?.produtos ?? []} bairros={dados?.bairros ?? []} indisponivel={!dados} rotuloConta={rotuloConta} />;
}
