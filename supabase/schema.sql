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

-- ------------------------------------------------------------
-- 5. GRADE ASSESSMENT SCORES (per-grade, per-CO assessment task)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grade_assessment_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade_id UUID NOT NULL REFERENCES public.grades(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (grade_id, task_key)
);

-- ------------------------------------------------------------
-- 6. SUBJECT ASSESSMENT TOTAL SCORES (per-subject, per-task max/total score)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subject_assessment_total_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  total_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (subject_id, task_key)
);

-- ------------------------------------------------------------
-- 7. SUBJECT INVITES (instructor share link/QR for student self-enrollment)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subject_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subject_invites_subject_id
  ON public.subject_invites (subject_id);

CREATE INDEX IF NOT EXISTS idx_subject_invites_token
  ON public.subject_invites (token);

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
ALTER TABLE public.grade_assessment_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_assessment_total_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_invites ENABLE ROW LEVEL SECURITY;

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

-- Grade assessment scores: instructors full access; students can read only their own via parent grade
DROP POLICY IF EXISTS "Instructors manage grade assessment scores" ON public.grade_assessment_scores;
CREATE POLICY "Instructors manage grade assessment scores" ON public.grade_assessment_scores
  FOR ALL USING (public.get_my_profile_role() = 'instructor');

DROP POLICY IF EXISTS "Students read own assessment scores" ON public.grade_assessment_scores;
CREATE POLICY "Students read own assessment scores" ON public.grade_assessment_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.grades g
      WHERE g.id = grade_assessment_scores.grade_id
      AND (
        g.student_profile_id = auth.uid()
        OR
        (
          g.student_profile_id IS NULL
          AND public.get_my_profile_student_number() IS NOT NULL
          AND public.get_my_profile_student_number() = g.student_number
        )
      )
    )
  );

-- Subject assessment total scores: instructors manage; authenticated users read
DROP POLICY IF EXISTS "Instructors manage subject assessment total scores" ON public.subject_assessment_total_scores;
CREATE POLICY "Instructors manage subject assessment total scores" ON public.subject_assessment_total_scores
  FOR ALL USING (public.get_my_profile_role() = 'instructor');

DROP POLICY IF EXISTS "Authenticated users read subject assessment total scores" ON public.subject_assessment_total_scores;
CREATE POLICY "Authenticated users read subject assessment total scores" ON public.subject_assessment_total_scores
  FOR SELECT TO authenticated USING (true);

-- Subject invites: instructors manage all; students can read only active + non-expired (for join screen)
DROP POLICY IF EXISTS "Instructors manage subject invites" ON public.subject_invites;
CREATE POLICY "Instructors manage subject invites" ON public.subject_invites
  FOR ALL USING (public.get_my_profile_role() = 'instructor')
  WITH CHECK (public.get_my_profile_role() = 'instructor');

DROP POLICY IF EXISTS "Students read active subject invites" ON public.subject_invites;
CREATE POLICY "Students read active subject invites" ON public.subject_invites
  FOR SELECT USING (
    public.get_my_profile_role() = 'student'
    AND is_active = TRUE
    AND expires_at > NOW()
  );

-- Security-definer RPC for student self-enrollment via invite token
CREATE OR REPLACE FUNCTION public.join_subject_with_token(invite_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_user_role TEXT;
  current_student_number TEXT;
  current_student_name TEXT;
  target_subject_id UUID;
  enrolled_grade_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to join a subject';
  END IF;

  SELECT p.role, p.student_number, p.full_name
  INTO current_user_role, current_student_number, current_student_name
  FROM public.profiles p
  WHERE p.id = current_user_id
  LIMIT 1;

  IF current_user_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'Only students can join a subject';
  END IF;

  IF current_student_number IS NULL OR current_student_number = '' THEN
    RAISE EXCEPTION 'Student number is required before joining a subject';
  END IF;

  SELECT si.subject_id
  INTO target_subject_id
  FROM public.subject_invites si
  WHERE si.token = invite_token
    AND si.is_active = TRUE
    AND si.expires_at > NOW()
  LIMIT 1;

  IF target_subject_id IS NULL THEN
    RAISE EXCEPTION 'Invite link is invalid or expired';
  END IF;

  INSERT INTO public.grades (
    subject_id,
    student_profile_id,
    student_name,
    student_number,
    total_grade
  ) VALUES (
    target_subject_id,
    current_user_id,
    current_student_name,
    current_student_number,
    0
  )
  ON CONFLICT (subject_id, student_number)
  DO UPDATE SET
    student_profile_id = EXCLUDED.student_profile_id,
    student_name = EXCLUDED.student_name,
    updated_at = NOW()
  RETURNING id INTO enrolled_grade_id;

  INSERT INTO public.grade_assessment_scores (grade_id, task_key, score)
  VALUES
    (enrolled_grade_id, 'co1_exercise1', 0),
    (enrolled_grade_id, 'co1_quiz1', 0),
    (enrolled_grade_id, 'co1_exam1', 0),
    (enrolled_grade_id, 'co2_exercise2', 0),
    (enrolled_grade_id, 'co2_exam1', 0),
    (enrolled_grade_id, 'co2_quiz2', 0),
    (enrolled_grade_id, 'co2_exam2', 0),
    (enrolled_grade_id, 'co2_presentation', 0),
    (enrolled_grade_id, 'co2_commodity_study_output', 0),
    (enrolled_grade_id, 'co3_exercise3', 0),
    (enrolled_grade_id, 'co3_quiz3', 0),
    (enrolled_grade_id, 'co3_exam2', 0),
    (enrolled_grade_id, 'co3_presentation', 0),
    (enrolled_grade_id, 'co3_commodity_study_output', 0)
  ON CONFLICT (grade_id, task_key) DO NOTHING;

  RETURN target_subject_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_subject_with_token(TEXT) TO authenticated;

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

DROP TRIGGER IF EXISTS grade_assessment_scores_updated_at ON public.grade_assessment_scores;
CREATE TRIGGER grade_assessment_scores_updated_at
  BEFORE UPDATE ON public.grade_assessment_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS subject_assessment_total_scores_updated_at ON public.subject_assessment_total_scores;
CREATE TRIGGER subject_assessment_total_scores_updated_at
  BEFORE UPDATE ON public.subject_assessment_total_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- DONE. You can now use the app with Supabase Auth and these tables.
-- ------------------------------------------------------------
