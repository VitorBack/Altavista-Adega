BEGIN;

GRANT UPDATE (nome_usuario) ON TABLE public.perfis TO authenticated;

DROP POLICY IF EXISTS perfis_editar_proprio_nome ON public.perfis;
CREATE POLICY perfis_editar_proprio_nome
ON public.perfis FOR UPDATE TO authenticated
USING (usuario_id = (SELECT auth.uid()))
WITH CHECK (usuario_id = (SELECT auth.uid()));

COMMIT;
