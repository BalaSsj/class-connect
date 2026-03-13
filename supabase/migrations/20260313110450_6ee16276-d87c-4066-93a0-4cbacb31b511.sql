
-- Period timings configuration table
CREATE TABLE public.period_timings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  period_number integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(department_id, period_number)
);

-- Default timings (null department_id = global defaults)
INSERT INTO public.period_timings (department_id, period_number, start_time, end_time) VALUES
  (null, 1, '09:00', '09:50'),
  (null, 2, '09:50', '10:40'),
  (null, 3, '10:50', '11:40'),
  (null, 4, '11:40', '12:30'),
  (null, 5, '13:30', '14:20'),
  (null, 6, '14:20', '15:10'),
  (null, 7, '15:10', '16:00');

ALTER TABLE public.period_timings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read period_timings" ON public.period_timings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage period_timings" ON public.period_timings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "HODs can manage dept period_timings" ON public.period_timings FOR ALL USING (
  has_role(auth.uid(), 'hod'::app_role) AND (department_id = get_hod_department_id(auth.uid()))
);

-- Add faculty_subjects RLS for HODs to manage
CREATE POLICY "HODs can manage dept faculty_subjects" ON public.faculty_subjects FOR ALL USING (
  has_role(auth.uid(), 'hod'::app_role) AND (
    faculty_id IN (SELECT id FROM faculty WHERE department_id = get_hod_department_id(auth.uid()))
  )
);
