import { NextResponse, type NextRequest } from "next/server";
import { criarClienteSessao } from "@/lib/supabase-auth";

export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });
  if (request.method !== "GET") return resposta;

  const supabase = criarClienteSessao({
    getAll: () => request.cookies.getAll(),
    setAll: (alteracoes, headers) => {
      for (const { name, value } of alteracoes) request.cookies.set(name, value);
      resposta = NextResponse.next({ request });
      for (const { name, value, options } of alteracoes) resposta.cookies.set(name, value, options);
      for (const [name, value] of Object.entries(headers)) resposta.headers.set(name, value);
    },
  });

  await supabase?.auth.getClaims();
  return resposta;
}

export const config = { matcher: ["/", "/conta"] };
