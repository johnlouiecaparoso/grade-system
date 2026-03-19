-- Add per-subject, per-task total scores (shared across all enrolled students)

CREATE TABLE IF NOT EXISTS public.subject_assessment_total_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  total_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (subject_id, task_key)
);

ALTER TABLE public.subject_assessment_total_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors manage subject assessment total scores" ON public.subject_assessment_total_scores;
CREATE POLICY "Instructors manage subject assessment total scores" ON public.subject_assessment_total_scores
  FOR ALL USING (public.get_my_profile_role() = 'instructor');

DROP POLICY IF EXISTS "Authenticated users read subject assessment total scores" ON public.subject_assessment_total_scores;
CREATE POLICY "Authenticated users read subject assessment total scores" ON public.subject_assessment_total_scores
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS subject_assessment_total_scores_updated_at ON public.subject_assessment_total_scores;
CREATE TRIGGER subject_assessment_total_scores_updated_at
  BEFORE UPDATE ON public.subject_assessment_total_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill zero rows for existing subjects and known assessment tasks
INSERT INTO public.subject_assessment_total_scores (subject_id, task_key, total_score)
SELECT s.id, t.task_key, 0
FROM public.subjects s
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
ON CONFLICT (subject_id, task_key) DO NOTHING;
