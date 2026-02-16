
-- Syllabus topics table for tracking covered/uncovered topics per subject
CREATE TABLE public.syllabus_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_number INTEGER NOT NULL,
  unit_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  is_covered BOOLEAN NOT NULL DEFAULT false,
  covered_by UUID REFERENCES public.faculty(id),
  covered_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.syllabus_topics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated can read syllabus_topics"
ON public.syllabus_topics FOR SELECT
USING (true);

CREATE POLICY "Admins can manage syllabus_topics"
ON public.syllabus_topics FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Faculty can update syllabus_topics"
ON public.syllabus_topics FOR UPDATE
USING (true);

CREATE POLICY "HODs can manage syllabus_topics"
ON public.syllabus_topics FOR ALL
USING (has_role(auth.uid(), 'hod'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_syllabus_topics_updated_at
BEFORE UPDATE ON public.syllabus_topics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index
CREATE INDEX idx_syllabus_topics_subject ON public.syllabus_topics(subject_id);
CREATE INDEX idx_syllabus_topics_covered ON public.syllabus_topics(is_covered);
