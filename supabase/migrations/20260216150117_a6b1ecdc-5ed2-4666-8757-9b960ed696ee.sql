
-- Create a security definer function to get HOD's department_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_hod_department_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.faculty
  WHERE user_id = _user_id AND is_hod = true
  LIMIT 1
$$;

-- Drop and recreate the problematic faculty policy
DROP POLICY IF EXISTS "HODs can manage dept faculty" ON public.faculty;
CREATE POLICY "HODs can manage dept faculty" ON public.faculty FOR ALL
USING (has_role(auth.uid(), 'hod'::app_role) AND department_id = get_hod_department_id(auth.uid()));

-- Fix subjects policy that also references faculty
DROP POLICY IF EXISTS "HODs can manage dept subjects" ON public.subjects;
CREATE POLICY "HODs can manage dept subjects" ON public.subjects FOR ALL
USING (has_role(auth.uid(), 'hod'::app_role) AND department_id = get_hod_department_id(auth.uid()));

-- Fix timetable_slots policy
DROP POLICY IF EXISTS "HODs can manage dept timetable" ON public.timetable_slots;
CREATE POLICY "HODs can manage dept timetable" ON public.timetable_slots FOR ALL
USING (has_role(auth.uid(), 'hod'::app_role) AND year_section_id IN (
  SELECT id FROM years_sections WHERE department_id = get_hod_department_id(auth.uid())
));

-- Fix attendance policy that references faculty
DROP POLICY IF EXISTS "Faculty can read own attendance" ON public.attendance;
CREATE POLICY "Faculty can read own attendance" ON public.attendance FOR SELECT
USING (faculty_id IN (
  SELECT id FROM public.faculty WHERE user_id = auth.uid()
));

-- Fix leave_requests policies
DROP POLICY IF EXISTS "Faculty can read own leave requests" ON public.leave_requests;
CREATE POLICY "Faculty can read own leave requests" ON public.leave_requests FOR SELECT
USING (faculty_id IN (
  SELECT id FROM public.faculty WHERE user_id = auth.uid()
));

DROP POLICY IF EXISTS "Faculty can create own leave requests" ON public.leave_requests;
CREATE POLICY "Faculty can create own leave requests" ON public.leave_requests FOR INSERT
WITH CHECK (faculty_id IN (
  SELECT id FROM public.faculty WHERE user_id = auth.uid()
));

-- Fix reallocations policies
DROP POLICY IF EXISTS "Faculty can read own reallocations" ON public.reallocations;
CREATE POLICY "Faculty can read own reallocations" ON public.reallocations FOR SELECT
USING (
  original_faculty_id IN (SELECT id FROM public.faculty WHERE user_id = auth.uid())
  OR substitute_faculty_id IN (SELECT id FROM public.faculty WHERE user_id = auth.uid())
);

-- Fix syllabus_topics policy
DROP POLICY IF EXISTS "Faculty can update syllabus_topics" ON public.syllabus_topics;
CREATE POLICY "Faculty can update syllabus_topics" ON public.syllabus_topics FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM faculty f JOIN timetable_slots ts ON ts.faculty_id = f.id
  WHERE f.user_id = auth.uid() AND ts.subject_id = syllabus_topics.subject_id
));
