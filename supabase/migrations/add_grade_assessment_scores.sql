-- Add per-task assessment scores for each grade (CO-based grading model)

CREATE TABLE IF NOT EXISTS public.grade_assessment_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade_id UUID NOT NULL REFERENCES public.grades(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (grade_id, task_key)
);

ALTER TABLE public.grade_assessment_scores ENABLE ROW LEVEL SECURITY;

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

DROP TRIGGER IF EXISTS grade_assessment_scores_updated_at ON public.grade_assessment_scores;
CREATE TRIGGER grade_assessment_scores_updated_at
  BEFORE UPDATE ON public.grade_assessment_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill: create zero-score task rows for all existing grade records
INSERT INTO public.grade_assessment_scores (grade_id, task_key, score)
SELECT g.id, t.task_key, 0
FROM public.grades g
CROSS JOIN (
  VALUES
    ('co1_exercise1'),
    ('co1_quiz1'),
    ('co1_exam1'),
    ('co2_exercise2'),
    ('co2_exam1'),
    ('co2_quiz2'),
    ('co2_exam2'),
    ('co2_presentation'),
    ('co2_commodity_study_output'),
    ('co3_exercise3'),
    ('co3_quiz3'),
    ('co3_exam2'),
    ('co3_presentation'),
    ('co3_commodity_study_output')
) AS t(task_key)
ON CONFLICT (grade_id, task_key) DO NOTHING;
