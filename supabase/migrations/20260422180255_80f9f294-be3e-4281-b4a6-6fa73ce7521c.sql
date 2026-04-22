-- Tabela singleton para configurações da integração Evolution API
CREATE TABLE public.integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_api_url text NOT NULL DEFAULT '',
  evolution_api_key text NOT NULL DEFAULT '',
  webhook_url text NOT NULL DEFAULT '',
  webhook_secret text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode LER (necessário pra UI carregar)
CREATE POLICY "Authenticated users can view settings"
  ON public.integration_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Apenas admins podem inserir/atualizar
CREATE POLICY "Admins can insert settings"
  ON public.integration_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update settings"
  ON public.integration_settings
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir linha singleton inicial (vazia)
INSERT INTO public.integration_settings (evolution_api_url, evolution_api_key, webhook_url, webhook_secret)
VALUES ('', '', '', '');