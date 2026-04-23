
-- ─────────────────────────────────────────────────────────
-- 1. RESET
-- ─────────────────────────────────────────────────────────

-- Drop policies that depend on old user_roles/has_role
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage numbers" ON public.whatsapp_numbers;
DROP POLICY IF EXISTS "Authenticated users can view numbers" ON public.whatsapp_numbers;
DROP POLICY IF EXISTS "Authenticated users can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Active users can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Active users can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Active users can insert messages" ON public.messages;

-- Drop old function and trigger
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Drop old user_roles table (will recreate with role_id)
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- ─────────────────────────────────────────────────────────
-- 2. NEW ROLES TABLE
-- ─────────────────────────────────────────────────────────

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  is_admin boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  pode_ver_dashboard boolean NOT NULL DEFAULT true,
  pode_ver_contatos boolean NOT NULL DEFAULT true,
  pode_gerenciar_contatos boolean NOT NULL DEFAULT false,
  pode_ver_automacoes boolean NOT NULL DEFAULT false,
  pode_gerenciar_automacoes boolean NOT NULL DEFAULT false,
  pode_enviar_mensagens boolean NOT NULL DEFAULT true,
  pode_gerenciar_numeros boolean NOT NULL DEFAULT false,
  pode_gerenciar_usuarios boolean NOT NULL DEFAULT false,
  pode_gerenciar_integracoes boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default roles
INSERT INTO public.roles (nome, descricao, is_admin, is_system,
  pode_ver_dashboard, pode_ver_contatos, pode_gerenciar_contatos,
  pode_ver_automacoes, pode_gerenciar_automacoes, pode_enviar_mensagens,
  pode_gerenciar_numeros, pode_gerenciar_usuarios, pode_gerenciar_integracoes)
VALUES
  ('Administrador', 'Acesso total ao sistema', true, true,
    true, true, true, true, true, true, true, true, true),
  ('Atendente', 'Atende conversas dos números vinculados', false, true,
    true, true, false, false, false, true, false, false, false);

-- ─────────────────────────────────────────────────────────
-- 3. NEW user_roles TABLE (points to roles.id)
-- ─────────────────────────────────────────────────────────

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────
-- 4. user_whatsapp_numbers (vínculo N:N)
-- ─────────────────────────────────────────────────────────

CREATE TABLE public.user_whatsapp_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  whatsapp_number_id uuid NOT NULL REFERENCES public.whatsapp_numbers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, whatsapp_number_id)
);

ALTER TABLE public.user_whatsapp_numbers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_uwn_user ON public.user_whatsapp_numbers(user_id);
CREATE INDEX idx_uwn_number ON public.user_whatsapp_numbers(whatsapp_number_id);

-- ─────────────────────────────────────────────────────────
-- 5. SECURITY DEFINER HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.is_admin = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _allowed boolean;
BEGIN
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM public.user_roles ur
       JOIN public.roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND (r.is_admin = true OR r.%I = true)
     )', _permission
  ) INTO _allowed USING _user_id;
  RETURN COALESCE(_allowed, false);
EXCEPTION WHEN undefined_column THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_number(_user_id uuid, _number_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_whatsapp_numbers
    WHERE user_id = _user_id AND whatsapp_number_id = _number_id
  )
$$;

-- ─────────────────────────────────────────────────────────
-- 6. handle_new_user — first user becomes admin
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _admin_id uuid;
  _atendente_id uuid;
  _role_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );

  SELECT id INTO _admin_id FROM public.roles WHERE nome = 'Administrador' LIMIT 1;
  SELECT id INTO _atendente_id FROM public.roles WHERE nome = 'Atendente' LIMIT 1;

  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    _role_id := _admin_id;
  ELSE
    _role_id := _atendente_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role_id) VALUES (NEW.id, _role_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────
-- 7. RLS POLICIES
-- ─────────────────────────────────────────────────────────

-- roles
CREATE POLICY "All authenticated can view roles" ON public.roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert roles" ON public.roles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update non-system roles" ON public.roles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete non-system roles" ON public.roles
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) AND is_system = false);

-- user_roles
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- user_whatsapp_numbers
CREATE POLICY "Users can view own number bindings" ON public.user_whatsapp_numbers
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage number bindings" ON public.user_whatsapp_numbers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- whatsapp_numbers
CREATE POLICY "Admins can manage numbers" ON public.whatsapp_numbers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Users can view assigned numbers" ON public.whatsapp_numbers
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_whatsapp_numbers
      WHERE user_id = auth.uid() AND whatsapp_number_id = whatsapp_numbers.id
    )
  );

-- conversations
CREATE POLICY "Users can view conversations of accessible numbers" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.user_can_access_number(auth.uid(), whatsapp_number_id));
CREATE POLICY "Users can insert conversations on accessible numbers" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_number(auth.uid(), whatsapp_number_id));
CREATE POLICY "Users can update conversations on accessible numbers" ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.user_can_access_number(auth.uid(), whatsapp_number_id));

-- messages
CREATE POLICY "Users can view messages of accessible numbers" ON public.messages
  FOR SELECT TO authenticated
  USING (public.user_can_access_number(auth.uid(), whatsapp_number_id));
CREATE POLICY "Users can insert messages on accessible numbers" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_access_number(auth.uid(), whatsapp_number_id)
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- contacts
CREATE POLICY "Admins can delete contacts" ON public.contacts
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- integration_settings
CREATE POLICY "Admins can insert integration settings" ON public.integration_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update integration settings" ON public.integration_settings
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
