"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { MAX_UNIDADES, precoUnitario, reais, type Bairro, type PedidoConfirmado, type Produto } from "@/lib/catalogo";

type Item = { produto: Produto; quantidade: number };

function Quantidade({ item, atualizar }: { item: Item; atualizar: (total: number) => void }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const { produto, quantidade } = item;

  return <div className="quantidade">
    <button type="button" aria-label={`Diminuir quantidade de ${produto.nome}`} disabled={quantidade <= 1} onClick={() => atualizar(quantidade - 1)}><Minus size={15} /></button>
    <input aria-label={`Quantidade de ${produto.nome}`} inputMode="numeric" maxLength={3} value={editando ? rascunho : quantidade}
      onFocus={(evento) => { setRascunho(String(quantidade)); setEditando(true); evento.target.select(); }}
      onChange={(evento) => {
        const valor = evento.target.value;
        if (!/^\d{0,3}$/.test(valor)) return;
        setRascunho(valor);
        if (Number(valor) >= 1 && Number(valor) <= MAX_UNIDADES) atualizar(Number(valor));
      }}
      onBlur={() => setEditando(false)}
      onKeyDown={(evento) => { if (evento.key === "Enter") evento.currentTarget.blur(); }} />
    <button type="button" aria-label={`Aumentar quantidade de ${produto.nome}`} disabled={quantidade >= MAX_UNIDADES} onClick={() => atualizar(quantidade + 1)}><Plus size={15} /></button>
  </div>;
}

type CarrinhoProps = {
  aberto: boolean;
  fechar: () => void;
  itens: Item[];
  bairros: Bairro[];
  indisponivel: boolean;
  itensIndisponiveis: string[];
  limparIndisponiveis: () => void;
  atualizarQuantidade: (id: string, quantidade: number) => void;
  esvaziar: () => void;
  atualizarCatalogo: () => void;
};

export function Carrinho({ aberto, fechar, itens, bairros, indisponivel, itensIndisponiveis, limparIndisponiveis, atualizarQuantidade, esvaziar, atualizarCatalogo }: CarrinhoProps) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const corpo = useRef<HTMLDivElement>(null);
  const tentativa = useRef<{ conteudo: string; id: string } | null>(null);
  const [etapa, setEtapa] = useState<"carrinho" | "entrega" | "confirmado">("carrinho");
  const [bairroId, setBairroId] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; codigo?: string } | null>(null);
  const [pedido, setPedido] = useState<PedidoConfirmado | null>(null);

  useEffect(() => {
    const modal = dialogo.current;
    if (aberto) modal?.showModal();
    else if (modal?.open) modal.close();
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
  }, [aberto]);

  useEffect(() => { corpo.current?.scrollTo(0, 0); }, [etapa]);

  const selecionado = bairros.find((bairro) => bairro.id === bairroId);
  const foraDaArea = !!bairroId && !selecionado;
  const subtotal = itens.reduce((total, { produto, quantidade }) => total + quantidade * precoUnitario(produto, quantidade), 0);
  const frete = selecionado?.frete_centavos;
  const total = frete === undefined ? undefined : subtotal + frete;
  const podeFinalizar = !!selecionado && itens.length > 0 && !indisponivel && itensIndisponiveis.length === 0;

  function encerrar() {
    fechar();
    setErro(null);
    if (etapa === "confirmado") { setEtapa("carrinho"); setPedido(null); }
  }

  function clicarFora(evento: MouseEvent<HTMLDialogElement>) {
    if (evento.target === evento.currentTarget && !ocupado) encerrar();
  }

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!selecionado || !podeFinalizar || ocupado) return;

    const dados = new FormData(evento.currentTarget);
    const conteudo = {
      nome: dados.get("nome"), telefone: dados.get("telefone"), logradouro: dados.get("logradouro"),
      numeroEndereco: dados.get("numeroEndereco"), complemento: dados.get("complemento"),
      bairroId: selecionado.id, freteCentavos: selecionado.frete_centavos,
      itens: itens.map(({ produto, quantidade }) => ({
        produto_id: produto.id, quantidade, preco_unitario_centavos: precoUnitario(produto, quantidade),
      })),
    };
    const serializado = JSON.stringify(conteudo);
    setOcupado(true);
    setErro(null);

    try {
      if (tentativa.current?.conteudo !== serializado) tentativa.current = { conteudo: serializado, id: crypto.randomUUID() };
      const resposta = await fetch("/api/pedidos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...conteudo, requisicao: tentativa.current.id }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) { setErro({ mensagem: dados.mensagem, codigo: dados.erro }); return; }

      setPedido(dados);
      setEtapa("confirmado");
      setBairroId("");
      tentativa.current = null;
      esvaziar();
    } catch {
      setErro({ mensagem: "A confirmação ficou indisponível. Tente novamente com os mesmos dados." });
    } finally {
      setOcupado(false);
    }
  }

  const titulo = etapa === "confirmado" ? "Pedido confirmado" : etapa === "entrega" ? "Finalizar pedido" : "Seu carrinho";

  return (
    <dialog className="painel" ref={dialogo} aria-labelledby="titulo-carrinho" onClick={clicarFora}
      onCancel={(evento) => { evento.preventDefault(); if (!ocupado) encerrar(); }}>
      <div className="painel-interior">
        <div className="painel-cabecalho">
          <h2 id="titulo-carrinho">{titulo}</h2>
          <button type="button" className="icone-botao" onClick={encerrar} aria-label="Fechar carrinho" disabled={ocupado}><X size={23} /></button>
        </div>

        <div className="painel-corpo" ref={corpo}>
          {etapa === "confirmado" && pedido ? <div className="confirmacao" role="status">
            <CheckCircle2 size={49} aria-hidden="true" />
            <h3>Pedido #{pedido.numero}</h3>
            <p>Seu pedido foi registrado com pagamento simulado.</p>
            <dl className="resumo">
              <div><dt>Subtotal</dt><dd>{reais(pedido.subtotal_centavos)}</dd></div>
              <div><dt>Frete</dt><dd>{reais(pedido.frete_centavos)}</dd></div>
              <div className="resumo-total"><dt>Total</dt><dd>{reais(pedido.total_centavos)}</dd></div>
            </dl>
            <button type="button" className="botao primario" onClick={encerrar}>Voltar à loja</button>
          </div> : <>
            {indisponivel && <p className="aviso erro" role="alert">O catálogo está indisponível. Tente atualizá-lo para continuar.</p>}
            {itensIndisponiveis.length > 0 && <div className="aviso">
              Alguns produtos no seu carrinho ficaram indisponíveis.
              <button type="button" className="link-botao" onClick={limparIndisponiveis}>Remover indisponíveis</button>
            </div>}

            {etapa === "carrinho" ? <>
              {itens.length ? <ul className="carrinho-itens">
                {itens.map((item) => {
                  const { produto, quantidade } = item;
                  const atacado = quantidade >= produto.minimo_atacado;
                  const unitario = precoUnitario(produto, quantidade);
                  return <li key={produto.id} className="carrinho-item">
                    <img src={produto.imagem_url} width={70} height={78} alt="" />
                    <div className="carrinho-item-corpo">
                      <h3>{produto.nome} <small>{produto.volume}</small></h3>
                      <p>{reais(unitario)} / un. <span className={atacado ? "preco-atacado" : "preco-varejo"}>{atacado ? "Atacado" : "Varejo"}</span></p>
                      {!atacado && <p className="minimo-carrinho">Atacado a partir de {produto.minimo_atacado} un.</p>}
                      <div className="carrinho-item-acoes">
                        <Quantidade item={item} atualizar={(valor) => atualizarQuantidade(produto.id, valor)} />
                        <button type="button" className="icone-botao remover" onClick={() => atualizarQuantidade(produto.id, 0)} aria-label={`Remover ${produto.nome}`}><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <strong className="item-subtotal">{reais(unitario * quantidade)}</strong>
                  </li>;
                })}
              </ul> : !indisponivel && <div className="carrinho-vazio">
                <ShoppingBag size={38} aria-hidden="true" /><p>Seu carrinho está vazio.</p>
                <button type="button" className="botao primario" onClick={encerrar}>Continuar comprando</button>
              </div>}
              {itens.length > 0 && <section className="frete" aria-label="Calcular frete">
                <label htmlFor="bairro">Bairro de entrega</label>
                <select id="bairro" value={foraDaArea ? "fora" : bairroId} onChange={(evento) => setBairroId(evento.target.value)}>
                  <option value="">Selecione o bairro</option>
                  {bairros.map((bairro) => <option key={bairro.id} value={bairro.id}>{bairro.nome} · {reais(bairro.frete_centavos)}</option>)}
                  <option value="fora">Meu bairro não está na lista</option>
                </select>
                {foraDaArea && <p className="aviso erro" role="alert">Ainda não entregamos no seu bairro.</p>}
              </section>}
            </> : <>
              <button type="button" disabled={ocupado} className="link-botao voltar-carrinho" onClick={() => { setEtapa("carrinho"); setErro(null); }}><ArrowLeft size={16} /> Voltar ao carrinho</button>
              <form id="dados-entrega" method="post" onSubmit={confirmar}>
                <fieldset disabled={ocupado} className="campos-entrega">
                  <legend>Dados de entrega</legend>
                  <label>Nome completo<input name="nome" autoComplete="name" maxLength={120} minLength={2} required /></label>
                  <label>Telefone com DDD<input name="telefone" autoComplete="tel" type="tel" maxLength={30} placeholder="(85) 99999-9999" required /></label>
                  <div className="endereco-campos">
                    <label>Rua ou avenida<input name="logradouro" autoComplete="address-line1" maxLength={160} minLength={3} required /></label>
                    <label>Número<input name="numeroEndereco" maxLength={20} required /></label>
                  </div>
                  <label>Complemento <small>(opcional)</small><input name="complemento" autoComplete="address-line2" maxLength={100} /></label>
                  <p className="entrega-bairro"><strong>Bairro</strong> {selecionado?.nome ?? "Selecione um bairro atendido no carrinho."}</p>
                </fieldset>
              </form>
              <div className="pagamento"><CreditCard size={22} aria-hidden="true" /><div><strong>Pagamento simulado</strong><p>Pedido de demonstração, sem cobrança.</p></div></div>
            </>}

            {erro && <div className="aviso erro" role="alert">
              <p>{erro.mensagem}</p>
              {erro.codigo === "maioridade" && <button type="button" className="link-botao" onClick={() => window.location.reload()}>Confirmar maioridade</button>}
              {erro.codigo && ["valores_alterados", "produto_indisponivel", "bairro_indisponivel"].includes(erro.codigo) &&
                <button type="button" className="link-botao" onClick={() => { atualizarCatalogo(); setEtapa("carrinho"); setErro(null); }}>Atualizar catálogo</button>}
            </div>}
          </>}
        </div>

        {etapa !== "confirmado" && (itens.length > 0 || etapa === "entrega") && <div className="painel-rodape">
          <dl className="resumo" aria-live="polite">
            <div><dt>Subtotal</dt><dd>{reais(subtotal)}</dd></div>
            <div><dt>Frete</dt><dd>{frete === undefined ? (foraDaArea ? "Indisponível" : "Selecione o bairro") : reais(frete)}</dd></div>
            <div className="resumo-total"><dt>Total</dt><dd>{total === undefined ? "—" : reais(total)}</dd></div>
          </dl>
          {etapa === "carrinho" ? <button type="button" className="botao primario" disabled={!podeFinalizar} onClick={() => setEtapa("entrega")}>Ir para o checkout <ArrowRight size={17} aria-hidden="true" /></button> :
            <button type="submit" form="dados-entrega" className="botao primario" disabled={!podeFinalizar || ocupado}>{ocupado ? "Confirmando…" : "Confirmar pedido"} <ArrowRight size={17} aria-hidden="true" /></button>}
        </div>}
      </div>
    </dialog>
  );
}
