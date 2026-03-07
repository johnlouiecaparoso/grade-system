-- ============================================================
-- College Grade System - Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor (New query)
-- ============================================================

-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 1. PROFILES (extends auth.users; role = student | instructor)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'instructor')),
  student_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, student_number)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NEW.raw_user_meta_data->>'student_number'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 2. SECTIONS (e.g. 1st Year - Section A)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year TEXT NOT NULL,
  section TEXT NOT NULL,
  student_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- If you already created sections without student_count, run:
-- ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS student_count INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 3. SUBJECTS (per section)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 4. GRADES (one row per student per subject; links to profile if logged-in student)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  student_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  student_number TEXT NOT NULL,
  quizzes NUMERIC(5,2) NOT NULL DEFAULT 0,
  summative NUMERIC(5,2) NOT NULL DEFAULT 0,
  midterm NUMERIC(5,2) NOT NULL DEFAULT 0,
  final NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_grade NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: unique constraint so same student_number isn't added twice per subject
CREATE UNIQUE INDEX IF NOT EXISTS idx_grades_subject_student_number
  ON public.grades (subject_id, student_number);

-- ------------------------------------------------------------
-- RLS helper: get current user's role/student_number without triggering RLS (breaks recursion)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_student_number()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT student_number FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- Drop policies first so this script is safe to run repeatedly.
-- Do NOT reference public.profiles inside profiles policies (causes infinite recursion).
-- ------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update own profile; instructors can read all (for dropdowns)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Instructors can read all profiles" ON public.profiles;
CREATE POLICY "Instructors can read all profiles" ON public.profiles
  FOR SELECT USING (public.get_my_profile_role() = 'instructor');

-- Sections: instructors can do everything; students can only read (for context)
DROP POLICY IF EXISTS "Instructors manage sections" ON public.sections;
CREATE POLICY "Instructors manage sections" ON public.sections
  FOR ALL USING (public.get_my_profile_role() = 'instructor');

DROP POLICY IF EXISTS "Anyone authenticated can read sections" ON public.sections;
CREATE POLICY "Anyone authenticated can read sections" ON public.sections
  FOR SELECT TO authenticated USING (true);

-- Subjects: same as sections
DROP POLICY IF EXISTS "Instructors manage subjects" ON public.subjects;
CREATE POLICY "Instructors manage subjects" ON public.subjects
  FOR ALL USING (public.get_my_profile_role() = 'instructor');

DROP POLICY IF EXISTS "Anyone authenticated can read subjects" ON public.subjects;
CREATE POLICY "Anyone authenticated can read subjects" ON public.subjects
  FOR SELECT TO authenticated USING (true);

-- Grades: instructors full access; students can read only their own (where student_profile_id = auth.uid())
DROP POLICY IF EXISTS "Instructors manage grades" ON public.grades;
CREATE POLICY "Instructors manage grades" ON public.grades
  FOR ALL USING (public.get_my_profile_role() = 'instructor');

DROP POLICY IF EXISTS "Students read own grades" ON public.grades;
CREATE POLICY "Students read own grades" ON public.grades
  FOR SELECT USING (
    student_profile_id = auth.uid()
    OR
    (student_profile_id IS NULL AND public.get_my_profile_student_number() IS NOT NULL AND public.get_my_profile_student_number() = grades.student_number)
  );

-- ------------------------------------------------------------
-- HELPER: update updated_at on profiles and grades
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS grades_updated_at ON public.grades;
CREATE TRIGGER grades_updated_at
  BEFORE UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- DONE. You can now use the app with Supabase Auth and these tables.
-- ------------------------------------------------------------
