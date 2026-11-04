-- ================================================================
-- MONEXITY — Endurecimiento de seguridad (fase 3: RPC de equipo)
-- Aplicado en Monexi (mnwzltvkwfxlpxuwshfo) como migraciones:
--   security_hardening_phase3a_change_member_role
--   security_hardening_phase3b_remove_member_containment
-- Idempotente. No borra datos ni desactiva RLS.
-- ================================================================

-- ── 1. change_member_role (usada por app/dashboard/team/actions.ts) ──
-- Solo el owner del negocio; el objetivo debe ser miembro de esa empresa;
-- el owner principal (companies.owner_user_id) y cualquier membresía owner
-- quedan protegidos; roles nuevos solo admin/seller; search_path fijo.

CREATE OR REPLACE FUNCTION public.change_member_role(
  p_company_id     uuid,
  p_target_user_id uuid,
  p_new_role       text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_owner_id    uuid;
  v_target_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_company_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023';
  END IF;

  IF p_new_role IS NULL OR p_new_role NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'Rol inválido.' USING ERRCODE = '22023';
  END IF;

  -- Solo el owner del negocio puede cambiar roles
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = v_uid
      AND m.company_id = p_company_id
      AND lower(m.role) = 'owner'
  ) THEN
    RAISE EXCEPTION 'Solo el dueño del negocio puede cambiar roles.' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id = v_uid THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol.' USING ERRCODE = '42501';
  END IF;

  SELECT c.owner_user_id INTO v_owner_id
  FROM public.companies c
  WHERE c.id = p_company_id;

  -- Owner principal protegido aunque su rol estuviera inconsistente
  IF p_target_user_id = v_owner_id THEN
    RAISE EXCEPTION 'No puedes modificar al dueño del negocio.' USING ERRCODE = '42501';
  END IF;

  SELECT m.role INTO v_target_role
  FROM public.memberships m
  WHERE m.company_id = p_company_id
    AND m.user_id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario no pertenece a este negocio.' USING ERRCODE = 'P0002';
  END IF;

  IF lower(v_target_role) = 'owner' THEN
    RAISE EXCEPTION 'No puedes modificar al dueño del negocio.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.memberships
  SET role = p_new_role
  WHERE company_id = p_company_id
    AND user_id = p_target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.change_member_role(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_member_role(uuid, uuid, text) TO authenticated, service_role;

-- ── 2. remove_member: contención provisional ─────────────────────
-- La app NO usa esta RPC (elimina miembros con createAdminClient tras validar
-- owner). Su cuerpo actual permite a un admin eliminar al owner, así que
-- queda sin acceso cliente hasta aplicar la versión endurecida de abajo.

ALTER FUNCTION public.remove_member(uuid, uuid) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.remove_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid, uuid) TO service_role;

-- ── Pendiente de aprobación manual (no aplicado) ─────────────────
-- Versión endurecida de remove_member. El control de aprobación de la sesión
-- canceló su aplicación (su cuerpo contiene DELETE). Al aplicarla, restaura
-- el acceso de authenticated.
--
-- CREATE OR REPLACE FUNCTION public.remove_member(
--   p_company_id     uuid,
--   p_target_user_id uuid
-- ) RETURNS void
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public, pg_temp
-- AS $$
-- DECLARE
--   v_uid         uuid := auth.uid();
--   v_owner_id    uuid;
--   v_target_role text;
-- BEGIN
--   IF v_uid IS NULL THEN
--     RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
--   END IF;
--
--   IF p_company_id IS NULL OR p_target_user_id IS NULL THEN
--     RAISE EXCEPTION 'Parámetros inválidos.' USING ERRCODE = '22023';
--   END IF;
--
--   IF NOT EXISTS (
--     SELECT 1 FROM public.memberships m
--     WHERE m.user_id = v_uid
--       AND m.company_id = p_company_id
--       AND lower(m.role) = 'owner'
--   ) THEN
--     RAISE EXCEPTION 'Solo el dueño del negocio puede eliminar miembros.' USING ERRCODE = '42501';
--   END IF;
--
--   IF p_target_user_id = v_uid THEN
--     RAISE EXCEPTION 'No puedes eliminarte a ti mismo del negocio.' USING ERRCODE = '42501';
--   END IF;
--
--   SELECT c.owner_user_id INTO v_owner_id
--   FROM public.companies c
--   WHERE c.id = p_company_id;
--
--   IF p_target_user_id = v_owner_id THEN
--     RAISE EXCEPTION 'No puedes eliminar al dueño del negocio.' USING ERRCODE = '42501';
--   END IF;
--
--   SELECT m.role INTO v_target_role
--   FROM public.memberships m
--   WHERE m.company_id = p_company_id
--     AND m.user_id = p_target_user_id
--   FOR UPDATE;
--
--   IF NOT FOUND THEN
--     RAISE EXCEPTION 'El usuario no pertenece a este negocio.' USING ERRCODE = 'P0002';
--   END IF;
--
--   IF lower(v_target_role) = 'owner' THEN
--     RAISE EXCEPTION 'No puedes eliminar al dueño del negocio.' USING ERRCODE = '42501';
--   END IF;
--
--   DELETE FROM public.memberships
--   WHERE company_id = p_company_id
--     AND user_id = p_target_user_id;
-- END;
-- $$;
--
-- REVOKE ALL ON FUNCTION public.remove_member(uuid, uuid) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.remove_member(uuid, uuid) TO authenticated, service_role;
