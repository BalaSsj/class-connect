
-- Fix overly permissive UPDATE policy on syllabus_topics
DROP POLICY "Faculty can update syllabus_topics" ON public.syllabus_topics;

CREATE POLICY "Faculty can update syllabus_topics"
ON public.syllabus_topics FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.faculty f
    JOIN public.timetable_slots ts ON ts.faculty_id = f.id
    WHERE f.user_id = auth.uid()
    AND ts.subject_id = syllabus_topics.subject_id
  )
);
