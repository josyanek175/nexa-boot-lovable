-- Corrige cast do ENUM attendance_status nas trigger functions
CREATE OR REPLACE FUNCTION public.update_on_outgoing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo <> 'saida' OR NEW.user_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.conversations
    SET status_atendimento = 'em_atendimento'::attendance_status,
        assigned_to = COALESCE(assigned_to, NEW.user_id),
        assigned_at = COALESCE(assigned_at, now()),
        first_response_at = COALESCE(first_response_at, NEW.data_envio),
        updated_at = now()
    WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_assign_on_incoming()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _conv RECORD;
  _last_user uuid;
  _least_busy uuid;
BEGIN
  IF NEW.tipo <> 'entrada' THEN RETURN NEW; END IF;

  SELECT * INTO _conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF _conv IS NULL THEN RETURN NEW; END IF;

  UPDATE public.conversations
    SET last_customer_message_at = NEW.data_envio,
        updated_at = now()
    WHERE id = NEW.conversation_id;

  IF _conv.assigned_to IS NOT NULL AND _conv.status_atendimento <> 'finalizado'::attendance_status THEN
    RETURN NEW;
  END IF;

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
          status_atendimento = 'pendente'::attendance_status
      WHERE id = NEW.conversation_id;
    RETURN NEW;
  END IF;

  SELECT uwn.user_id INTO _least_busy
  FROM public.user_whatsapp_numbers uwn
  WHERE uwn.whatsapp_number_id = _conv.whatsapp_number_id
  ORDER BY (
    SELECT COUNT(*) FROM public.conversations c2
    WHERE c2.assigned_to = uwn.user_id AND c2.status_atendimento = 'em_atendimento'::attendance_status
  ) ASC, RANDOM()
  LIMIT 1;

  IF _least_busy IS NOT NULL THEN
    UPDATE public.conversations
      SET assigned_to = _least_busy,
          assigned_at = now(),
          status_atendimento = 'pendente'::attendance_status
      WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Garante que os triggers existem (idempotente)
DROP TRIGGER IF EXISTS trg_auto_assign_on_incoming ON public.messages;
CREATE TRIGGER trg_auto_assign_on_incoming
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_on_incoming();

DROP TRIGGER IF EXISTS trg_update_on_outgoing ON public.messages;
CREATE TRIGGER trg_update_on_outgoing
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_on_outgoing();