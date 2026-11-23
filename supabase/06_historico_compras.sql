begin;

alter table public.pedidos
  add column if not exists usuario_id uuid references auth.users(id) on delete set null;

create index if not exists pedidos_usuario_numero_idx
  on public.pedidos (usuario_id, numero desc) where usuario_id is not null;

-- A assinatura nova também aceita chamadas da versão anterior da loja (compra como visitante).
drop function if exists public.registrar_pedido(uuid, text, text, text, text, text, uuid, integer, jsonb);

create or replace function public.registrar_pedido(
  p_requisicao uuid, p_nome text, p_telefone text, p_logradouro text,
  p_numero_endereco text, p_complemento text, p_bairro uuid,
  p_frete_esperado integer, p_itens jsonb, p_usuario_id uuid default null
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
    if v_pedido.hash_requisicao <> v_hash or v_pedido.usuario_id is distinct from p_usuario_id then
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
      requisicao, hash_requisicao, usuario_id, nome, telefone, logradouro, numero_endereco, complemento,
      bairro_id, bairro_nome, subtotal_centavos, frete_centavos
    ) values (
      p_requisicao, v_hash, p_usuario_id, p_nome, p_telefone, p_logradouro, p_numero_endereco, p_complemento,
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

revoke execute on function public.registrar_pedido(uuid, text, text, text, text, text, uuid, integer, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.registrar_pedido(uuid, text, text, text, text, text, uuid, integer, jsonb, uuid)
  to service_role;

-- O histórico usa a identidade da sessão. As tabelas continuam fechadas para acesso direto.
create or replace function public.minhas_compras(p_antes_de bigint, p_limite integer)
returns table (
  numero text, criado_em timestamptz, subtotal_centavos bigint,
  frete_centavos integer, total_centavos bigint, itens jsonb
)
language sql stable security definer
set search_path = ''
as $$
  select p.numero::text, p.criado_em, p.subtotal_centavos, p.frete_centavos, p.total_centavos,
    coalesce((select jsonb_agg(jsonb_build_object(
      'produto_id', i.produto_id, 'produto_nome', i.produto_nome,
      'quantidade', i.quantidade, 'subtotal_centavos', i.subtotal_centavos
    ) order by i.produto_nome, i.produto_id)
    from public.itens_pedido i where i.pedido_numero = p.numero), '[]'::jsonb)
  from public.pedidos p
  where p.usuario_id = (select auth.uid())
    and (p_antes_de is null or p.numero < p_antes_de)
  order by p.numero desc
  limit least(greatest(p_limite, 1), 50);
$$;

revoke all on function public.minhas_compras(bigint, integer) from public, anon, service_role;
grant execute on function public.minhas_compras(bigint, integer) to authenticated;

notify pgrst, 'reload schema';
commit;
