
-- Attendance tracking table
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  timetable_slot_id uuid NOT NULL REFERENCES public.timetable_slots(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'on_duty')),
  marked_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(faculty_id, timetable_slot_id, attendance_date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage attendance" ON public.attendance FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "HODs can manage attendance" ON public.attendance FOR ALL USING (has_role(auth.uid(), 'hod'::app_role));
CREATE POLICY "Faculty can read own attendance" ON public.attendance FOR SELECT USING (
  faculty_id IN (SELECT id FROM faculty WHERE user_id = auth.uid())
);

-- Exam schedules table
CREATE TABLE public.exam_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  year_section_id uuid NOT NULL REFERENCES public.years_sections(id) ON DELETE CASCADE,
  exam_type text NOT NULL DEFAULT 'internal' CHECK (exam_type IN ('internal', 'model', 'semester', 'retest')),
  exam_date date NOT NULL,
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '12:00',
  room text,
  invigilator_id uuid REFERENCES public.faculty(id),
  created_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage exam_schedules" ON public.exam_schedules FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "HODs can manage exam_schedules" ON public.exam_schedules FOR ALL USING (has_role(auth.uid(), 'hod'::app_role));
CREATE POLICY "Authenticated can read exam_schedules" ON public.exam_schedules FOR SELECT USING (true);

CREATE TRIGGER update_exam_schedules_updated_at BEFORE UPDATE ON public.exam_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Announcements table
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "HODs can manage announcements" ON public.announcements FOR ALL USING (has_role(auth.uid(), 'hod'::app_role));
CREATE POLICY "Authenticated can read announcements" ON public.announcements FOR SELECT USING (true);

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
