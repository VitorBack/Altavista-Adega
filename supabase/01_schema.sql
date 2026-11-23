begin;

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null check (char_length(nome) between 1 and 120),
  categoria text not null check (categoria in ('cervejas', 'vinhos', 'destilados', 'refrigerantes', 'energeticos', 'agua')),
  volume text not null,
  imagem_url text not null,
  varejo_centavos integer not null check (varejo_centavos > 0),
  atacado_centavos integer not null check (atacado_centavos > 0 and atacado_centavos <= varejo_centavos),
  minimo_atacado integer not null check (minimo_atacado between 2 and 999),
  mais_vendido boolean not null default false,
  oferta_da_semana boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0
);

create table public.bairros (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  frete_centavos integer not null check (frete_centavos >= 0),
  atendido boolean not null default true
);

create table public.pedidos (
  numero bigint generated always as identity primary key,
  requisicao uuid not null unique,
  hash_requisicao bytea not null,
  nome text not null check (char_length(nome) between 2 and 120),
  telefone text not null check (telefone ~ '^[0-9]{10,13}$'),
  logradouro text not null check (char_length(logradouro) between 3 and 160),
  numero_endereco text not null check (char_length(numero_endereco) between 1 and 20),
  complemento text not null default '' check (char_length(complemento) <= 100),
  bairro_id uuid not null references public.bairros(id),
  bairro_nome text not null,
  subtotal_centavos bigint not null check (subtotal_centavos > 0),
  frete_centavos integer not null check (frete_centavos >= 0),
  total_centavos bigint generated always as (subtotal_centavos + frete_centavos) stored,
  pagamento text not null default 'simulado' check (pagamento = 'simulado'),
  criado_em timestamptz not null default now()
);

create table public.itens_pedido (
  pedido_numero bigint not null references public.pedidos(numero) on delete cascade,
  produto_id uuid not null references public.produtos(id),
  produto_nome text not null,
  quantidade integer not null check (quantidade between 1 and 999),
  tipo_preco text not null check (tipo_preco in ('varejo', 'atacado')),
  preco_unitario_centavos integer not null check (preco_unitario_centavos > 0),
  subtotal_centavos bigint generated always as (quantidade::bigint * preco_unitario_centavos) stored,
  primary key (pedido_numero, produto_id)
);

alter table public.produtos enable row level security;
alter table public.bairros enable row level security;
alter table public.pedidos enable row level security;
alter table public.itens_pedido enable row level security;

revoke all on public.produtos, public.bairros, public.pedidos, public.itens_pedido
  from public, anon, authenticated, service_role;
revoke all on sequence public.pedidos_numero_seq from public, anon, authenticated, service_role;
grant select on public.produtos, public.bairros to service_role;
grant select on public.pedidos, public.itens_pedido to service_role;

create function public.registrar_pedido(
  p_requisicao uuid, p_nome text, p_telefone text, p_logradouro text,
  p_numero_endereco text, p_complemento text, p_bairro uuid,
  p_frete_esperado integer, p_itens jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_bairro public.bairros%rowtype;
  v_hash bytea;
  v_itens jsonb;
  v_subtotal bigint;
  v_precos_conferem boolean;
begin
  if jsonb_typeof(p_itens) is distinct from 'array' then
    raise exception 'itens_invalidos';
  end if;

  if jsonb_array_length(p_itens) not between 1 and 100 or exists (
    select 1 from jsonb_to_recordset(p_itens) as i(produto_id uuid, quantidade integer, preco_unitario_centavos integer)
    where i.produto_id is null or i.quantidade is null or i.quantidade not between 1 and 999
      or i.preco_unitario_centavos is null or i.preco_unitario_centavos <= 0
  ) or (
    select count(distinct i.produto_id) from jsonb_to_recordset(p_itens) as i(produto_id uuid)
  ) <> jsonb_array_length(p_itens) then
    raise exception 'itens_invalidos';
  end if;

  v_hash := sha256(convert_to(jsonb_build_array(
    p_nome, p_telefone, p_logradouro, p_numero_endereco, p_complemento, p_bairro, p_frete_esperado,
    (select jsonb_agg(i order by i->>'produto_id') from jsonb_array_elements(p_itens) as linhas(i))
  )::text, 'UTF8'));
  -- Serializa confirmações repetidas da mesma tentativa, inclusive após uma falha de rede.
  perform pg_advisory_xact_lock(hashtextextended(p_requisicao::text, 0));
  select * into v_pedido from public.pedidos where requisicao = p_requisicao;

  if found then
    if v_pedido.hash_requisicao <> v_hash then
      raise exception 'requisicao_reutilizada';
    end if;
  else
    select * into v_bairro from public.bairros
      where id = p_bairro and atendido for share;
    if not found then
      raise exception 'bairro_indisponivel';
    end if;

    -- Mantém os preços e a disponibilidade estáveis até o fim da transação.
    with selecionados as (
      select p.id as produto_id, p.nome as produto_nome, i.quantidade,
        case when i.quantidade >= p.minimo_atacado then 'atacado' else 'varejo' end as tipo_preco,
        case when i.quantidade >= p.minimo_atacado then p.atacado_centavos else p.varejo_centavos end as preco_unitario_centavos,
        i.preco_unitario_centavos as preco_esperado
      from jsonb_to_recordset(p_itens) as i(produto_id uuid, quantidade integer, preco_unitario_centavos integer)
      join public.produtos p on p.id = i.produto_id and p.ativo
      order by p.id for share of p
    )
    select jsonb_agg(to_jsonb(s) - 'preco_esperado'),
      sum(s.quantidade::bigint * s.preco_unitario_centavos),
      bool_and(s.preco_unitario_centavos = s.preco_esperado)
    into v_itens, v_subtotal, v_precos_conferem
    from selecionados s;

    if v_itens is null or jsonb_array_length(v_itens) <> jsonb_array_length(p_itens) then
      raise exception 'produto_indisponivel';
    end if;
    if p_frete_esperado is distinct from v_bairro.frete_centavos or not v_precos_conferem then
      raise exception 'valores_alterados';
    end if;

    insert into public.pedidos (
      requisicao, hash_requisicao, nome, telefone, logradouro, numero_endereco, complemento,
      bairro_id, bairro_nome, subtotal_centavos, frete_centavos
    ) values (
      p_requisicao, v_hash, p_nome, p_telefone, p_logradouro, p_numero_endereco, p_complemento,
      v_bairro.id, v_bairro.nome, v_subtotal, v_bairro.frete_centavos
    ) returning * into v_pedido;

    insert into public.itens_pedido (pedido_numero, produto_id, produto_nome, quantidade, tipo_preco, preco_unitario_centavos)
      select v_pedido.numero, i.produto_id, i.produto_nome, i.quantidade, i.tipo_preco, i.preco_unitario_centavos
      from jsonb_to_recordset(v_itens) as i(
        produto_id uuid, produto_nome text, quantidade integer, tipo_preco text, preco_unitario_centavos integer
      );
  end if;

  return jsonb_build_object('numero', v_pedido.numero::text, 'subtotal_centavos', v_pedido.subtotal_centavos,
    'frete_centavos', v_pedido.frete_centavos, 'total_centavos', v_pedido.total_centavos);
end;
$$;

revoke execute on function public.registrar_pedido(uuid, text, text, text, text, text, uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.registrar_pedido(uuid, text, text, text, text, text, uuid, integer, jsonb)
  to service_role;

notify pgrst, 'reload schema';
commit;



BEGIN;

CREATE TABLE public.perfis (
  usuario_id uuid PRIMARY KEY DEFAULT auth.uid()
    REFERENCES auth.users (id) ON DELETE CASCADE,
  nome_usuario text NOT NULL UNIQUE
    CHECK (nome_usuario ~ '^[a-z0-9_]{3,30}$'),
  data_nascimento date NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT perfis_data_nascimento_valida CHECK (
    isfinite(data_nascimento)
    AND data_nascimento <= (criado_em AT TIME ZONE 'America/Fortaleza')::date
  )
);

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.perfis
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.perfis TO authenticated;
GRANT INSERT (nome_usuario, data_nascimento)
ON TABLE public.perfis TO authenticated;

CREATE POLICY perfis_ler_proprio
ON public.perfis FOR SELECT TO authenticated
USING (usuario_id = (SELECT auth.uid()));

CREATE POLICY perfis_criar_proprio
ON public.perfis FOR INSERT TO authenticated
WITH CHECK (usuario_id = (SELECT auth.uid()));

COMMIT;