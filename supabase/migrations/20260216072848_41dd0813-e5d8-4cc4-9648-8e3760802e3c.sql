
-- Storage bucket for syllabus PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('syllabus-pdfs', 'syllabus-pdfs', true);

-- Storage policies
CREATE POLICY "HODs and admins can upload syllabus PDFs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'syllabus-pdfs' AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'hod')
  )
);

CREATE POLICY "Anyone authenticated can read syllabus PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'syllabus-pdfs');

CREATE POLICY "HODs and admins can delete syllabus PDFs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'syllabus-pdfs' AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'hod')
  )
);

-- Add daily scheduling columns to syllabus_topics
ALTER TABLE public.syllabus_topics 
ADD COLUMN IF NOT EXISTS scheduled_date date,
ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id);

-- Add syllabus PDF reference to subjects
ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS syllabus_pdf_url text;
