
-- Allow HODs to manage subjects in their department
CREATE POLICY "HODs can manage dept subjects" ON public.subjects FOR ALL USING (
  has_role(auth.uid(), 'hod'::app_role) AND
  department_id IN (SELECT department_id FROM faculty WHERE user_id = auth.uid() AND is_hod = true)
);

-- Allow HODs to manage timetable slots for their department sections
CREATE POLICY "HODs can manage dept timetable" ON public.timetable_slots FOR ALL USING (
  has_role(auth.uid(), 'hod'::app_role) AND
  year_section_id IN (
    SELECT ys.id FROM years_sections ys
    JOIN faculty f ON f.department_id = ys.department_id
    WHERE f.user_id = auth.uid() AND f.is_hod = true
  )
);

-- Allow HODs to manage faculty in their department
CREATE POLICY "HODs can manage dept faculty" ON public.faculty FOR ALL USING (
  has_role(auth.uid(), 'hod'::app_role) AND
  department_id IN (SELECT department_id FROM faculty WHERE user_id = auth.uid() AND is_hod = true)
);
