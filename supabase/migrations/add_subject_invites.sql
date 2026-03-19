-- Subject invite links + student self-join RPC

CREATE TABLE IF NOT EXISTS public.subject_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subject_invites_subject_id ON public.subject_invites(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_invites_token ON public.subject_invites(token);

ALTER TABLE public.subject_invites ENABLE ROW LEVEL SECURITY;

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
