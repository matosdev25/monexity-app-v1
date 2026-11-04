-- ================================================================
-- MONEXITY — Ninguna función SECURITY DEFINER ejecutable por anon/PUBLIC
-- Aplicada en Monexi como revoke_anon_security_definer_functions.
-- Verificado: 0 funciones SECURITY DEFINER de public ejecutables por anon
-- (antes 9) y el asesor de seguridad ya no las reporta para anon.
-- ================================================================

-- Helpers de RLS y de equipo: solo usuarios con sesión (y servidor)
REVOKE ALL ON FUNCTION public.get_my_company_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_company_role(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin_of(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_last_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_company_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_company_role(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_of(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_last_admin(uuid, uuid) TO authenticated, service_role;

-- Aceptar invitación: lo invoca un usuario autenticado (app/dashboard/team/actions.ts)
REVOKE ALL ON FUNCTION public.accept_company_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_company_invite(text) TO authenticated, service_role;

-- Sin uso desde el cliente: solo servidor
REVOKE ALL ON FUNCTION public.get_valid_company_invite(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_next_invoice_number(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_next_quotation_number(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_valid_company_invite(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_next_invoice_number(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_next_quotation_number(uuid) TO service_role;
