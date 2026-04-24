-- Adicionar flag para contatos criados automaticamente via webhook
ALTER TABLE public.contacts 
  ADD COLUMN IF NOT EXISTS is_temporary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- Garantir que phone_number da whatsapp_numbers possa ser nulo durante auto-criação
-- (já é nullable, apenas confirmação)

-- Índice para busca rápida por telefone
CREATE INDEX IF NOT EXISTS idx_contacts_telefone ON public.contacts(telefone);
CREATE INDEX IF NOT EXISTS idx_contacts_is_temporary ON public.contacts(is_temporary) WHERE is_temporary = true;