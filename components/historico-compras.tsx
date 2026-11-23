import Link from "next/link";
import { reais, type PedidoConfirmado } from "@/lib/catalogo";
import type { supabaseSessao } from "@/lib/supabase-auth";

type Compra = PedidoConfirmado & {
  criado_em: string;
  itens: { produto_id: string; produto_nome: string; quantidade: number; subtotal_centavos: number }[];
};

const porPagina = 5;
const dataCompra = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza",
});

export async function HistoricoCompras({ supabase, antes }: {
  supabase: NonNullable<Awaited<ReturnType<typeof supabaseSessao>>>;
  antes?: string | string[];
}) {
  const cursor = typeof antes === "string" && /^[1-9]\d{0,18}$/.test(antes) && BigInt(antes) <= BigInt("9223372036854775807")
    ? antes : null;
  const { data, error } = await supabase.rpc("minhas_compras", {
    p_antes_de: cursor, p_limite: porPagina + 1,
  }).returns<Compra[]>();
  const compras = Array.isArray(data) ? data.slice(0, porPagina) : [];
  const temAnteriores = Array.isArray(data) && data.length > porPagina;
  const ultima = compras.at(-1);

  return (
    <section className="historico-compras" id="compras" aria-labelledby="titulo-compras">
      <h2 id="titulo-compras">Minhas compras</h2>
      {error || !Array.isArray(data) ? (
        <p className="aviso erro" role="alert">Não foi possível carregar as compras. Atualize a página para tentar novamente.</p>
      ) : compras.length === 0 ? (
        <p>{cursor ? "Você chegou ao fim do histórico." : "Você ainda não fez compras com esta conta."}</p>
      ) : (
        <ul className="lista-compras">
          {compras.map((compra) => (
            <li key={compra.numero}>
              <details>
                <summary>
                  <span className="compra-cabecalho">
                    <strong>Pedido #{compra.numero}</strong><strong>{reais(compra.total_centavos)}</strong>
                    <time dateTime={compra.criado_em}>{dataCompra.format(new Date(compra.criado_em))}</time>
                  </span>
                </summary>
                <ul className="compra-itens">
                  {compra.itens.map((item) => (
                    <li key={item.produto_id}>
                      <span>{item.quantidade} × {item.produto_nome}</span><span>{reais(item.subtotal_centavos)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="compra-valores">
                  <div><dt>Subtotal</dt><dd>{reais(compra.subtotal_centavos)}</dd></div>
                  <div><dt>Frete</dt><dd>{reais(compra.frete_centavos)}</dd></div>
                </dl>
              </details>
            </li>
          ))}
        </ul>
      )}
      {(cursor || temAnteriores) && (
        <nav className="compras-navegacao" aria-label="Páginas de compras">
          {cursor && <Link className="link-botao" href="/conta#compras" prefetch={false}>Mais recentes</Link>}
          {temAnteriores && ultima && (
            <Link className="link-botao" href={`/conta?antes=${ultima.numero}#compras`} prefetch={false}>Compras anteriores</Link>
          )}
        </nav>
      )}
    </section>
  );
}
