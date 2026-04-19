ALTER TABLE public.reallocations DROP CONSTRAINT IF EXISTS reallocations_status_check;
ALTER TABLE public.reallocations ADD CONSTRAINT reallocations_status_check
  CHECK (status = ANY (ARRAY['suggested'::text, 'pending'::text, 'approved'::text, 'rejected'::text, 'completed'::text]));