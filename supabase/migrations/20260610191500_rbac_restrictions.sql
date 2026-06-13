-- Add is_restricted column to profiles
ALTER TABLE public.profiles ADD COLUMN is_restricted BOOLEAN NOT NULL DEFAULT false;

-- Restrict uploading: must NOT be restricted AND must be lecturer or admin
DROP POLICY "Authenticated can upload" ON public.notes;
CREATE POLICY "Restricted upload" ON public.notes
  FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by AND 
    NOT (SELECT is_restricted FROM public.profiles WHERE id = auth.uid()) AND
    (public.has_role(auth.uid(), 'lecturer') OR public.has_role(auth.uid(), 'admin'))
  );

-- Restrict commenting: must NOT be restricted
DROP POLICY "Users comment" ON public.comments;
CREATE POLICY "Users comment" ON public.comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    NOT (SELECT is_restricted FROM public.profiles WHERE id = auth.uid())
  );

-- Restrict rating: must NOT be restricted
DROP POLICY "Users rate" ON public.ratings;
CREATE POLICY "Users rate" ON public.ratings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    NOT (SELECT is_restricted FROM public.profiles WHERE id = auth.uid())
  );
