export const categorias = {
  cervejas: "Cervejas",
  vinhos: "Vinhos",
  destilados: "Destilados",
  refrigerantes: "Refrigerantes",
  energeticos: "Energéticos",
  agua: "Água",
} as const;

export type Categoria = keyof typeof categorias;

export type Produto = {
  id: string;
  nome: string;
  categoria: Categoria;
  volume: string;
  imagem_url: string;
  varejo_centavos: number;
  atacado_centavos: number;
  minimo_atacado: number;
  mais_vendido: boolean;
  oferta_da_semana: boolean;
};

export type Bairro = { id: string; nome: string; frete_centavos: number };

export type PedidoConfirmado = {
  numero: string;
  subtotal_centavos: number;
  frete_centavos: number;
  total_centavos: number;
};

export const MAX_UNIDADES = 999;
export const MAX_ITENS = 100;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function reais(centavos: number) {
  return brl.format(centavos / 100);
}

export function precoUnitario(produto: Produto, quantidade: number) {
  return quantidade >= produto.minimo_atacado ? produto.atacado_centavos : produto.varejo_centavos;
}

export function textoDeBusca(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").trim();
}
