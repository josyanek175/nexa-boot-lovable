DO $$
DECLARE
  _josy uuid := '017fee1a-9e65-4fac-ab37-aae32a9b54c1';
  _bruno uuid := '58f4bbaa-4b70-4b0f-9a65-bfb2433163fd';
  _admin uuid := 'e7462c08-3dcc-48c5-96c3-78b64ff6babb';
  _atendente uuid := '8c9cedd6-a7ae-4c67-b516-265a9c728184';
BEGIN
  -- Profile josyane
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _josy) THEN
    INSERT INTO public.profiles (user_id, nome, email, status)
    VALUES (_josy, 'josyane', 'josyanek175@gmail.com', 'ativo');
  ELSE
    UPDATE public.profiles SET nome='josyane', status='ativo' WHERE user_id=_josy;
  END IF;

  -- Role josyane = admin
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_josy) THEN
    UPDATE public.user_roles SET role_id=_admin WHERE user_id=_josy;
  ELSE
    INSERT INTO public.user_roles (user_id, role_id) VALUES (_josy, _admin);
  END IF;

  -- Reverter bruno para atendente (estava admin por engano)
  UPDATE public.user_roles SET role_id=_atendente WHERE user_id=_bruno;
END $$;