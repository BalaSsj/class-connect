
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'public',
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(holiday_date, department_id)
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read holidays" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage holidays" ON public.holidays FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "HODs can manage holidays" ON public.holidays FOR ALL TO authenticated USING (has_role(auth.uid(), 'hod'::app_role));
