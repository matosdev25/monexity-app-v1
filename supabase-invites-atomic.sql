-- ================================================================
-- MONEXITY — Consumo atómico de invitaciones
-- Aplicada en Monexi como consume_company_invite_atomic y verificada con rollback
-- (consumo, segundo uso → invalid, ya miembro → already_member, código inválido).
-- Usada por joinViaCode (app/onboarding/actions.ts) con service_role.
-- ================================================================

CREATE OR REPLACE FUNCTION public.consume_company_invite(
  p_invite_code text,
  p_user_id     uuid
) RETURNS TABLE (status text, company_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code   text;
  v_invite record;
  v_role   text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario requerido.' USING ERRCODE = '22023';
  END IF;

  v_code := upper(regexp_replace(trim(coalesce(p_invite_code, '')), '[-\s]+', '', 'g'));
  IF length(v_code) < 6 THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;

  -- Bloqueo de la invitación: una solicitud concurrente espera y luego ya no la ve válida
  SELECT ci.id, ci.company_id, ci.role
  INTO v_invite
  FROM public.company_invites ci
  WHERE ci.code = v_code
    AND ci.is_active = true
    AND ci.used_by IS NULL
    AND ci.expires_at > now()
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.company_id = v_invite.company_id
      AND m.user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT 'already_member'::text, v_invite.company_id;
    RETURN;
  END IF;

  v_role := CASE
    WHEN lower(coalesce(v_invite.role, '')) IN ('owner', 'admin', 'seller') THEN lower(v_invite.role)
    ELSE 'seller'
  END;

  INSERT INTO public.memberships (company_id, user_id, role)
  VALUES (v_invite.company_id, p_user_id, v_role);

  UPDATE public.company_invites
  SET used_by = p_user_id,
      used_at = now(),
      is_active = false
  WHERE id = v_invite.id;

  RETURN QUERY SELECT 'joined'::text, v_invite.company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_company_invite(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_company_invite(text, uuid) TO service_role;
