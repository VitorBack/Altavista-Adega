"use client";

import { ArrowDown, ArrowRight, Beer, BottleWine, CupSoda, Droplet, Grid2X2, MapPin, PackageCheck, Plus, Search, ShoppingBag, Tags, Truck, Wine, X, Zap } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { categorias, MAX_ITENS, MAX_UNIDADES, reais, textoDeBusca, type Bairro, type Categoria, type Produto } from "@/lib/catalogo";
import { Carrinho } from "./carrinho";
import { Marca } from "./marca";

const icones = { cervejas: Beer, vinhos: Wine, destilados: BottleWine, refrigerantes: CupSoda, energeticos: Zap, agua: Droplet };
const categoriasOrdenadas = Object.keys(categorias) as Categoria[];
const chaveCarrinho = "altavista-carrinho-v1";

type Filtro = Categoria | "todos" | "ofertas" | "selecao";

function FotoProduto({ produto }: { produto: Produto }) {
  const [falhou, setFalhou] = useState(false);
  const Icone = icones[produto.categoria];
  return falhou ? <Icone className="foto-alternativa" size={56} aria-label={produto.nome} role="img" /> : (
    <img src={produto.imagem_url} alt={produto.nome} onError={() => setFalhou(true)} loading="lazy" decoding="async" />
  );
}

function CardProduto({ produto, quantidade, adicionar, cheio, destacarOferta }: {
  produto: Produto; quantidade: number; adicionar: () => void; cheio: boolean; destacarOferta: boolean;
}) {
  return (
    <article className="produto">
      <div className="produto-foto">
        {destacarOferta && produto.oferta_da_semana && <span className="etiqueta">Oferta da semana</span>}
        <FotoProduto key={produto.imagem_url} produto={produto} />
      </div>
      <div className="produto-corpo">
        <p className="produto-atributos">{categorias[produto.categoria]} <span>·</span> {produto.volume}</p>
        <h3>{produto.nome}</h3>
        <p className="produto-varejo"><strong>{reais(produto.varejo_centavos)}</strong><span>no varejo</span></p>
        <div className="produto-atacado">
          <span><strong>{reais(produto.atacado_centavos)}</strong> / un.</span>
          <small>Atacado a partir de {produto.minimo_atacado} un.</small>
        </div>
        <button type="button" className="botao adicionar" onClick={adicionar} disabled={cheio}
          aria-label={`Adicionar ${produto.nome}${quantidade ? `, ${quantidade} no carrinho` : ""}`}>
          <Plus size={16} aria-hidden="true" /> Adicionar {quantidade > 0 && <span className="adicionado">{quantidade}</span>}
        </button>
      </div>
    </article>
  );
}

export function Loja({ produtos, bairros, indisponivel }: { produtos: Produto[]; bairros: Bairro[]; indisponivel: boolean }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [campoBusca, setCampoBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [carrinho, setCarrinho] = useState<Record<string, number>>({});
  const [carrinhoCarregado, setCarrinhoCarregado] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [anuncio, setAnuncio] = useState("");

  useEffect(() => {
    try {
      const salvo: unknown = JSON.parse(localStorage.getItem(chaveCarrinho) ?? "{}");
      if (salvo && typeof salvo === "object" && !Array.isArray(salvo)) {
        setCarrinho(Object.fromEntries(Object.entries(salvo).filter(([id, quantidade]) =>
          /^[a-f0-9-]{36}$/i.test(id) && Number.isInteger(quantidade) && quantidade > 0 && quantidade <= MAX_UNIDADES,
        ).slice(0, MAX_ITENS)));
      }
    } catch {
      // O carrinho segue disponível em memória quando o navegador bloqueia o armazenamento.
    }
    setCarrinhoCarregado(true);
  }, []);

  useEffect(() => {
    if (!carrinhoCarregado || indisponivel) return;
    try { localStorage.setItem(chaveCarrinho, JSON.stringify(carrinho)); } catch { /* armazenamento indisponível */ }
  }, [carrinho, carrinhoCarregado, indisponivel]);

  const itens = produtos.filter((produto) => carrinho[produto.id] > 0)
    .map((produto) => ({ produto, quantidade: carrinho[produto.id] }));
  const unidades = itens.reduce((total, item) => total + item.quantidade, 0);
  const idsDisponiveis = new Set(produtos.map((produto) => produto.id));
  const itensIndisponiveis = indisponivel ? [] : Object.keys(carrinho).filter((id) => !idsDisponiveis.has(id));
  const nomeFiltro = filtro === "todos" ? "Todas as bebidas" : filtro === "ofertas" ? "Ofertas da semana"
    : filtro === "selecao" ? "Vinhos & destilados" : categorias[filtro];
  const encontrados = produtos.filter((produto) => {
    const categoriaOk = filtro === "todos"
      || (filtro === "ofertas" && produto.oferta_da_semana)
      || (filtro === "selecao" && (produto.categoria === "vinhos" || produto.categoria === "destilados"))
      || produto.categoria === filtro;
    return categoriaOk && textoDeBusca(produto.nome).includes(textoDeBusca(termo));
  });

  function rolarCatalogo() {
    document.getElementById("catalogo")?.scrollIntoView({ block: "start" });
  }

  function selecionar(proximo: Filtro) {
    setFiltro(proximo);
    setCatalogoAberto(true);
    setCampoBusca("");
    setTermo("");
    rolarCatalogo();
  }

  function inicio() {
    setFiltro("todos");
    setCatalogoAberto(false);
    setCampoBusca("");
    setTermo("");
    window.scrollTo({ top: 0 });
  }

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setTermo(campoBusca.trim());
    setCatalogoAberto(true);
    rolarCatalogo();
  }

  function atualizarQuantidade(id: string, quantidade: number) {
    setCarrinho((atual) => {
      const proximo = { ...atual };
      if (quantidade <= 0) delete proximo[id];
      else proximo[id] = Math.min(quantidade, MAX_UNIDADES);
      return proximo;
    });
  }

  function adicionar(produto: Produto) {
    setCarrinho((atual) => {
      const quantidade = atual[produto.id] ?? 0;
      if (quantidade >= MAX_UNIDADES || (!quantidade && Object.keys(atual).length >= MAX_ITENS)) return atual;
      return { ...atual, [produto.id]: quantidade + 1 };
    });
    setAnuncio(`${produto.nome} adicionado ao carrinho.`);
  }

  function grade(lista: Produto[], destacarOferta = false) {
    return <div className="grade-produtos">{lista.map((produto) => (
      <CardProduto key={produto.id} produto={produto} quantidade={carrinho[produto.id] ?? 0}
        cheio={carrinho[produto.id] >= MAX_UNIDADES || (!carrinho[produto.id] && Object.keys(carrinho).length >= MAX_ITENS)}
        adicionar={() => adicionar(produto)} destacarOferta={destacarOferta} />
    ))}</div>;
  }

  function secao(titulo: string, lista: Produto[], textoAcao: string, acao: Filtro) {
    if (!lista.length) return null;
    return <section className="secao-catalogo" aria-label={titulo}>
      <div className="secao-cabecalho">
        <h2>{titulo}</h2>
        <button className="link-botao" type="button" onClick={() => selecionar(acao)}>{textoAcao}<ArrowRight size={16} aria-hidden="true" /></button>
      </div>
      {grade(lista.slice(0, 4))}
    </section>;
  }

  return (
    <>
      <a className="pular" href="#catalogo">Pular para o catálogo</a>
      <header className="cabecalho">
        <div className="faixa-topo"><Truck size={14} aria-hidden="true" /> Entrega local com frete fixo por bairro</div>
        <div className="cabecalho-linha limite">
          <button type="button" className="marca-botao" onClick={inicio} aria-label="Altavista, página inicial"><Marca /></button>
          <form className="busca" role="search" onSubmit={buscar}>
            <Search size={19} aria-hidden="true" />
            <input type="search" name="busca" aria-label="Buscar bebidas pelo nome" placeholder="O que você está procurando?"
              value={campoBusca} maxLength={120} onChange={(evento) => setCampoBusca(evento.target.value)} />
            <button className="botao primario" type="submit">Buscar</button>
          </form>
          <button type="button" className="carrinho-botao" onClick={() => setPainelAberto(true)}
            aria-label={`Abrir carrinho, ${unidades} ${unidades === 1 ? "unidade" : "unidades"}`}>
            <span className="carrinho-icone"><ShoppingBag size={22} aria-hidden="true" /><span className="contagem">{unidades}</span></span>
            <span className="carrinho-texto">Carrinho</span>
          </button>
        </div>
        <nav className="navegacao" aria-label="Categorias de bebidas">
          <div className="limite navegacao-linha">
            <button type="button" onClick={() => selecionar("todos")} aria-pressed={filtro === "todos"}><Grid2X2 size={16} aria-hidden="true" /> Todas as bebidas</button>
            {categoriasOrdenadas.map((categoria) => {
              const Icone = icones[categoria];
              return <button key={categoria} type="button" onClick={() => selecionar(categoria)} aria-pressed={filtro === categoria}>
                <Icone size={17} aria-hidden="true" />{categorias[categoria]}
              </button>;
            })}
            <button type="button" onClick={() => selecionar("ofertas")} aria-pressed={filtro === "ofertas"}><Tags size={17} aria-hidden="true" /> Ofertas</button>
          </div>
        </nav>
      </header>

      <main>
        <section className="heroi">
          <div className="heroi-foto" aria-hidden="true" />
          <div className="limite heroi-corpo">
            <p className="sobretitulo">Brinde aos bons momentos</p>
            <h1>Seleção especial de<br /><em>vinhos &amp; destilados</em></h1>
            <p className="heroi-descricao">Rótulos escolhidos para o seu próximo brinde, com preços de varejo e atacado.</p>
            <div className="heroi-acoes">
              <button type="button" className="botao ouro" onClick={() => selecionar("selecao")}>Explorar seleção <ArrowRight size={17} aria-hidden="true" /></button>
              <button type="button" className="link-heroi" onClick={() => selecionar("ofertas")}>Ver ofertas <ArrowDown size={15} aria-hidden="true" /></button>
            </div>
          </div>
        </section>
        <div className="vantagens">
          <div className="limite vantagens-linha">
            <div><Truck size={22} aria-hidden="true" /><span><strong>Entrega local</strong><small>Taxa por bairro</small></span></div>
            <div><Tags size={22} aria-hidden="true" /><span><strong>Preço de atacado</strong><small>Desconto por volume</small></span></div>
            <div><PackageCheck size={22} aria-hidden="true" /><span><strong>Compra como visitante</strong><small>Sem cadastro</small></span></div>
          </div>
        </div>

        <div id="catalogo" className="limite catalogo" tabIndex={-1}>
          {indisponivel ? <div className="estado-vazio">
            <h2>Catálogo temporariamente indisponível</h2>
            <p>Tente carregar os produtos novamente.</p>
            <button type="button" className="botao primario" onClick={() => router.refresh()}>Tentar novamente</button>
          </div> : catalogoAberto ? <section className="secao-catalogo">
            <div className="secao-cabecalho">
              <div><h2>{nomeFiltro}</h2>{termo && <p className="termo-busca">Resultados para “{termo}”</p>}</div>
              <button className="link-botao" type="button" onClick={() => { setCatalogoAberto(false); setFiltro("todos"); setTermo(""); setCampoBusca(""); }}>
                <X size={17} aria-hidden="true" /> Limpar filtros
              </button>
            </div>
            {encontrados.length ? grade(encontrados, filtro !== "ofertas") : <p className="estado-vazio">Nenhuma bebida encontrada. Tente outro nome ou categoria.</p>}
          </section> : <>
            {secao("Mais vendidos", produtos.filter((produto) => produto.mais_vendido), "Ver catálogo", "todos")}
            <section className="bloco-atacado" aria-labelledby="titulo-atacado">
              <div className="bloco-atacado-icone"><Tags size={30} aria-hidden="true" /></div>
              <div><h2 id="titulo-atacado">Compre mais, pague menos</h2>
                <p>Ao atingir o mínimo de um produto, o preço de atacado vale para todas as unidades dele. Confira as quantidades em cada card.</p></div>
              <button type="button" className="botao ouro" onClick={() => selecionar("todos")}>Ver produtos <ArrowRight size={16} aria-hidden="true" /></button>
            </section>
            {secao("Ofertas da semana", produtos.filter((produto) => produto.oferta_da_semana), "Ver ofertas", "ofertas")}
            {produtos.length === 0 && <p className="estado-vazio">Ainda não há bebidas no catálogo.</p>}
            {produtos.length > 0 && !produtos.some((produto) => produto.mais_vendido || produto.oferta_da_semana) &&
              <section className="secao-catalogo"><h2>Todas as bebidas</h2>{grade(produtos)}</section>}
          </>}
        </div>
      </main>

      <footer className="rodape">
        <div className="limite rodape-linha"><Marca /><p><MapPin size={16} aria-hidden="true" /> Entrega nos bairros atendidos</p><p>Projeto acadêmico · Loja demonstrativa</p></div>
      </footer>
      <span className="somente-leitor" role="status">{anuncio}</span>
      <Carrinho aberto={painelAberto} fechar={() => setPainelAberto(false)} itens={itens} bairros={bairros} indisponivel={indisponivel}
        itensIndisponiveis={itensIndisponiveis} limparIndisponiveis={() => setCarrinho((atual) => Object.fromEntries(Object.entries(atual).filter(([id]) => idsDisponiveis.has(id))))}
        atualizarQuantidade={atualizarQuantidade} esvaziar={() => setCarrinho({})} atualizarCatalogo={() => router.refresh()} />
    </>
  );
}
