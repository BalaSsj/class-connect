
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'hod', 'faculty');

-- User roles table (secure, separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles: users can read their own roles, admins can manage all
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "HODs can read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'hod'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Departments
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read departments"
  ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage departments"
  ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Years & Sections
CREATE TABLE public.years_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  year INT NOT NULL CHECK (year BETWEEN 1 AND 4),
  section TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, year, section)
);
ALTER TABLE public.years_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read years_sections"
  ON public.years_sections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage years_sections"
  ON public.years_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Subjects
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_lab BOOLEAN NOT NULL DEFAULT false,
  year INT NOT NULL CHECK (year BETWEEN 1 AND 4),
  semester INT NOT NULL CHECK (semester BETWEEN 1 AND 8),
  credits INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, code)
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read subjects"
  ON public.subjects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage subjects"
  ON public.subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Faculty
CREATE TABLE public.faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  employee_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  designation TEXT NOT NULL DEFAULT 'Assistant Professor',
  expertise TEXT[] DEFAULT '{}',
  lab_qualified BOOLEAN NOT NULL DEFAULT false,
  max_periods_per_day INT NOT NULL DEFAULT 6,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_hod BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.faculty ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read faculty"
  ON public.faculty FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage faculty"
  ON public.faculty FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Faculty can update own record"
  ON public.faculty FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Faculty-Subject mapping
CREATE TABLE public.faculty_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id UUID REFERENCES public.faculty(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (faculty_id, subject_id)
);
ALTER TABLE public.faculty_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read faculty_subjects"
  ON public.faculty_subjects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage faculty_subjects"
  ON public.faculty_subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Timetable slots
CREATE TABLE public.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_section_id UUID REFERENCES public.years_sections(id) ON DELETE CASCADE NOT NULL,
  faculty_id UUID REFERENCES public.faculty(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  period_number INT NOT NULL CHECK (period_number BETWEEN 1 AND 7),
  is_lab BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year_section_id, day_of_week, period_number)
);
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read timetable"
  ON public.timetable_slots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage timetable"
  ON public.timetable_slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Leave requests
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id UUID REFERENCES public.faculty(id) ON DELETE CASCADE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('casual', 'medical', 'earned', 'od', 'emergency')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Faculty can read own leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (faculty_id IN (SELECT id FROM public.faculty WHERE user_id = auth.uid()));

CREATE POLICY "Faculty can create own leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (faculty_id IN (SELECT id FROM public.faculty WHERE user_id = auth.uid()));

CREATE POLICY "HODs can read all leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'hod'));

CREATE POLICY "HODs can update leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'hod'));

CREATE POLICY "Admins can manage leave requests"
  ON public.leave_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Reallocations
CREATE TABLE public.reallocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_faculty_id UUID REFERENCES public.faculty(id) ON DELETE CASCADE NOT NULL,
  substitute_faculty_id UUID REFERENCES public.faculty(id) ON DELETE CASCADE NOT NULL,
  timetable_slot_id UUID REFERENCES public.timetable_slots(id) ON DELETE CASCADE NOT NULL,
  leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL,
  reallocation_date DATE NOT NULL,
  score NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'approved', 'rejected', 'completed')),
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reallocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Faculty can read own reallocations"
  ON public.reallocations FOR SELECT TO authenticated
  USING (
    original_faculty_id IN (SELECT id FROM public.faculty WHERE user_id = auth.uid())
    OR substitute_faculty_id IN (SELECT id FROM public.faculty WHERE user_id = auth.uid())
  );

CREATE POLICY "HODs can manage reallocations"
  ON public.reallocations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'hod'));

CREATE POLICY "Admins can manage reallocations"
  ON public.reallocations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'reallocation')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "HODs can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'hod'));

-- Lab manuals
CREATE TABLE public.lab_manuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  experiment_number INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_manuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read lab manuals"
  ON public.lab_manuals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage lab manuals"
  ON public.lab_manuals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_faculty_updated_at BEFORE UPDATE ON public.faculty FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reallocations_updated_at BEFORE UPDATE ON public.reallocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
