
-- 1. Novo enum para status de atendimento
DO $$ BEGIN
  CREATE TYPE public.attendance_status AS ENUM ('pendente', 'em_atendimento', 'finalizado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Adicionar colunas em conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS status_atendimento public.attendance_status NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid;

CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON public.conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_status_atendimento ON public.conversations(status_atendimento);
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_status ON public.conversations(whatsapp_number_id, status_atendimento);

-- 3. SLA por número
ALTER TABLE public.whatsapp_numbers
  ADD COLUMN IF NOT EXISTS sla_minutes integer NOT NULL DEFAULT 5;

-- 4. Permissão de reatribuir em roles
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS pode_reatribuir_conversas boolean NOT NULL DEFAULT false;

-- 5. Criar role "Gerente" se não existir
INSERT INTO public.roles (nome, descricao, is_admin, is_system, pode_ver_dashboard, pode_ver_contatos, pode_gerenciar_contatos, pode_ver_automacoes, pode_enviar_mensagens, pode_reatribuir_conversas)
SELECT 'Gerente', 'Pode reatribuir conversas e gerenciar atendimento', false, true, true, true, true, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE nome = 'Gerente');

-- 6. Função: pode reatribuir conversa
CREATE OR REPLACE FUNCTION public.can_reassign_conversations(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND (r.is_admin = true OR r.pode_reatribuir_conversas = true)
  )
$$;

-- 7. Trigger: atribuição automática ao receber mensagem do cliente (entrada)
CREATE OR REPLACE FUNCTION public.auto_assign_on_incoming()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _conv RECORD;
  _last_user uuid;
  _least_busy uuid;
BEGIN
  IF NEW.tipo <> 'entrada' THEN RETURN NEW; END IF;

  SELECT * INTO _conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF _conv IS NULL THEN RETURN NEW; END IF;

  -- Atualiza última mensagem do cliente
  UPDATE public.conversations
    SET last_customer_message_at = NEW.data_envio,
        updated_at = now()
    WHERE id = NEW.conversation_id;

  -- Se já tem atendente, nada mais a fazer
  IF _conv.assigned_to IS NOT NULL AND _conv.status_atendimento <> 'finalizado' THEN
    RETURN NEW;
  END IF;

  -- 1. Continuidade: último atendente que respondeu esse contato
  SELECT m.user_id INTO _last_user
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE c.contact_id = _conv.contact_id
    AND m.tipo = 'saida'
    AND m.user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_whatsapp_numbers uwn
      WHERE uwn.user_id = m.user_id AND uwn.whatsapp_number_id = _conv.whatsapp_number_id
    )
  ORDER BY m.data_envio DESC
  LIMIT 1;

  IF _last_user IS NOT NULL THEN
    UPDATE public.conversations
      SET assigned_to = _last_user,
          assigned_at = now(),
          status_atendimento = 'pendente'
      WHERE id = NEW.conversation_id;
    RETURN NEW;
  END IF;

  -- 2. Menor carga: atendente vinculado ao número com menos conversas em_atendimento
  SELECT uwn.user_id INTO _least_busy
  FROM public.user_whatsapp_numbers uwn
  WHERE uwn.whatsapp_number_id = _conv.whatsapp_number_id
  ORDER BY (
    SELECT COUNT(*) FROM public.conversations c2
    WHERE c2.assigned_to = uwn.user_id AND c2.status_atendimento = 'em_atendimento'
  ) ASC, RANDOM()
  LIMIT 1;

  IF _least_busy IS NOT NULL THEN
    UPDATE public.conversations
      SET assigned_to = _least_busy,
          assigned_at = now(),
          status_atendimento = 'pendente'
      WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_on_incoming ON public.messages;
CREATE TRIGGER trg_auto_assign_on_incoming
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_on_incoming();

-- 8. Trigger: ao enviar mensagem (saida), marcar em_atendimento + first_response_at
CREATE OR REPLACE FUNCTION public.update_on_outgoing()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.tipo <> 'saida' OR NEW.user_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.conversations
    SET status_atendimento = CASE WHEN status_atendimento = 'finalizado' THEN 'em_atendimento' ELSE 'em_atendimento' END,
        assigned_to = COALESCE(assigned_to, NEW.user_id),
        assigned_at = COALESCE(assigned_at, now()),
        first_response_at = COALESCE(first_response_at, NEW.data_envio),
        updated_at = now()
    WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_on_outgoing ON public.messages;
CREATE TRIGGER trg_update_on_outgoing
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_on_outgoing();

-- 9. Política: permitir UPDATE em messages? Não. Apenas em conversations já existe.
-- Garantir que conversations possa ser atualizada por reatribuidores
DROP POLICY IF EXISTS "Reassigners can transfer conversations" ON public.conversations;
CREATE POLICY "Reassigners can transfer conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (public.can_reassign_conversations(auth.uid()))
  WITH CHECK (public.can_reassign_conversations(auth.uid()));

-- 10. Backfill: conversas existentes que têm mensagens recebem status correto
UPDATE public.conversations c
SET status_atendimento = CASE
  WHEN EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id AND m.tipo = 'saida') THEN 'em_atendimento'::public.attendance_status
  ELSE 'pendente'::public.attendance_status
END
WHERE c.status_atendimento IS NULL OR c.status_atendimento = 'pendente';
