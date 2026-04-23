-- Apaga mensagens, conversas e os próprios números de teste
DELETE FROM public.messages
WHERE whatsapp_number_id IN (
  SELECT id FROM public.whatsapp_numbers
  WHERE instance_name IN ('test-instance', 'test-instance-final')
);

DELETE FROM public.conversations
WHERE whatsapp_number_id IN (
  SELECT id FROM public.whatsapp_numbers
  WHERE instance_name IN ('test-instance', 'test-instance-final')
);

DELETE FROM public.user_whatsapp_numbers
WHERE whatsapp_number_id IN (
  SELECT id FROM public.whatsapp_numbers
  WHERE instance_name IN ('test-instance', 'test-instance-final')
);

DELETE FROM public.whatsapp_numbers
WHERE instance_name IN ('test-instance', 'test-instance-final');