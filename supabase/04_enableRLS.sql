ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;



BEGIN;

CREATE POLICY bairros_bloquear_acesso_direto
ON public.bairros AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY produtos_bloquear_acesso_direto
ON public.produtos AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY pedidos_bloquear_acesso_direto
ON public.pedidos AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY itens_pedido_bloquear_acesso_direto
ON public.itens_pedido AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

COMMIT;