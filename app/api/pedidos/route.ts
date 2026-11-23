import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MAX_ITENS, MAX_UNIDADES, type PedidoConfirmado } from "@/lib/catalogo";
import { COOKIE_MAIORIDADE, comprovanteValido } from "@/lib/maioridade";
import { supabaseServidor } from "@/lib/supabase";
import { supabaseSessao } from "@/lib/supabase-auth";

export const runtime = "nodejs";

const dinheiro = z.number().int().nonnegative().max(2_147_483_647);
const pedidoSchema = z.object({
  requisicao: z.uuid(),
  nome: z.string().trim().min(2).max(120),
  telefone: z.string().trim().max(30).regex(/^[\d+()\s-]+$/).transform((valor) => valor.replace(/\D/g, ""))
    .pipe(z.string().min(10).max(13)),
  logradouro: z.string().trim().min(3).max(160),
  numeroEndereco: z.string().trim().min(1).max(20),
  complemento: z.string().trim().max(100),
  bairroId: z.uuid(),
  freteCentavos: dinheiro,
  itens: z.array(z.object({
    produto_id: z.uuid(),
    quantidade: z.number().int().min(1).max(MAX_UNIDADES),
    preco_unitario_centavos: dinheiro,
  })).min(1).max(MAX_ITENS).refine((itens) => new Set(itens.map((item) => item.produto_id)).size === itens.length),
});

const erros: Record<string, { status: number; mensagem: string }> = {
  bairro_indisponivel: { status: 422, mensagem: "Ainda não entregamos no bairro selecionado." },
  produto_indisponivel: { status: 409, mensagem: "Um produto deixou de estar disponível. Atualize o catálogo e revise o carrinho." },
  valores_alterados: { status: 409, mensagem: "Os preços ou o frete mudaram. Atualize o catálogo e confira os novos valores." },
  requisicao_reutilizada: { status: 409, mensagem: "Esta confirmação já foi utilizada. Revise o pedido antes de tentar novamente." },
  itens_invalidos: { status: 400, mensagem: "Revise os itens e as quantidades do carrinho." },
};

export async function POST(request: NextRequest) {
  if (!comprovanteValido(request.cookies.get(COOKIE_MAIORIDADE)?.value)) {
    return NextResponse.json({ erro: "maioridade", mensagem: "Confirme sua idade novamente para finalizar o pedido." }, { status: 403 });
  }

  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return NextResponse.json({ mensagem: "Formato de solicitação inválido." }, { status: 415 });
  }

  const resultado = pedidoSchema.safeParse(await request.json().catch(() => null));
  if (!resultado.success) {
    return NextResponse.json({ mensagem: "Confira os dados de entrega, o telefone com DDD e os itens do carrinho." }, { status: 400 });
  }

  const pedido = resultado.data;
  try {
    const sessao = await supabaseSessao(true);
    const identidade = await sessao?.auth.getClaims();
    if (identidade?.error) {
      return NextResponse.json({ mensagem: "Não foi possível verificar sua sessão. Atualize a página e tente novamente." }, { status: 503 });
    }

    const { data, error } = await supabaseServidor().rpc("registrar_pedido", {
      p_requisicao: pedido.requisicao,
      p_usuario_id: identidade?.data?.claims.sub ?? null,
      p_nome: pedido.nome,
      p_telefone: pedido.telefone,
      p_logradouro: pedido.logradouro,
      p_numero_endereco: pedido.numeroEndereco,
      p_complemento: pedido.complemento,
      p_bairro: pedido.bairroId,
      p_frete_esperado: pedido.freteCentavos,
      p_itens: pedido.itens,
    }).returns<PedidoConfirmado>();

    if (error?.code === "P0001" && Object.hasOwn(erros, error.message)) {
      const { status, mensagem } = erros[error.message];
      return NextResponse.json({ erro: error.message, mensagem }, { status });
    }
    if (error || !data) throw new Error("Pedido sem confirmação do banco");

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ mensagem: "Não conseguimos confirmar o pedido. Tente novamente." }, { status: 503 });
  }
}
