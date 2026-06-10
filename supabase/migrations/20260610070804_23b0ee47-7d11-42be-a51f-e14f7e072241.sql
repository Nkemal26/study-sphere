
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_restricted(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_restricted FROM public.profiles WHERE id = _user_id), false)
$$;

-- NOTES: only lecturers or admins can upload
DROP POLICY IF EXISTS "Authenticated can upload" ON public.notes;
CREATE POLICY "Lecturers and admins upload" ON public.notes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND (public.has_role(auth.uid(),'lecturer') OR public.has_role(auth.uid(),'admin'))
  AND NOT public.is_restricted(auth.uid())
);

-- COMMENTS: block restricted users
DROP POLICY IF EXISTS "Users comment" ON public.comments;
CREATE POLICY "Users comment" ON public.comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND NOT public.is_restricted(auth.uid()));

-- RATINGS: block restricted users
DROP POLICY IF EXISTS "Users rate" ON public.ratings;
CREATE POLICY "Users rate" ON public.ratings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND NOT public.is_restricted(auth.uid()));

-- Admins can update any profile (for restriction toggle)
DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'));
