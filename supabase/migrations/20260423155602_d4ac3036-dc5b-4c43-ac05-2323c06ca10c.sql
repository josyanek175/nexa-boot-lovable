DO $$
DECLARE
  _uid uuid := '58f4bbaa-4b70-4b0f-9a65-bfb2433163fd';
  _admin_role uuid := 'e7462c08-3dcc-48c5-96c3-78b64ff6babb';
BEGIN
  -- garante profile
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _uid) THEN
    INSERT INTO public.profiles (user_id, nome, email, status)
    VALUES (_uid, 'josyane', 'josyanek175@gmail.com', 'ativo');
  ELSE
    UPDATE public.profiles SET nome='josyane', status='ativo' WHERE user_id=_uid;
  END IF;

  -- garante role admin
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid) THEN
    UPDATE public.user_roles SET role_id=_admin_role WHERE user_id=_uid;
  ELSE
    INSERT INTO public.user_roles (user_id, role_id) VALUES (_uid, _admin_role);
  END IF;
END $$;