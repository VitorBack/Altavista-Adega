import { cookies } from "next/headers";
import { Loja } from "@/components/loja";
import { Entrada } from "@/components/entrada";
import { COOKIE_MAIORIDADE, comprovanteValido } from "@/lib/maioridade";
import { carregarLoja } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const cookie = (await cookies()).get(COOKIE_MAIORIDADE)?.value;
  if (!comprovanteValido(cookie)) return <Entrada />;

  const dados = await carregarLoja().catch(() => null);
  return <Loja produtos={dados?.produtos ?? []} bairros={dados?.bairros ?? []} indisponivel={!dados} />;
}
