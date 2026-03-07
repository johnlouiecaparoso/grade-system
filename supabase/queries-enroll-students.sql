-- ============================================================
-- Queries: Add students to subject by ID number
-- Only students that exist in profiles (role = 'student') with
-- a matching student_number can be added to a subject.
-- ============================================================

-- 1) List all students that can be enrolled (registered students with ID number)
-- Use this to see which student numbers are valid when adding to a subject.
SELECT id, full_name, student_number, email
FROM public.profiles
WHERE role = 'student'
  AND student_number IS NOT NULL
  AND student_number != ''
ORDER BY student_number;

-- 2) Check if a student with a given ID number exists (replace 'STU001' with the ID)
-- Returns one row if the student exists and can be added.
SELECT id, full_name, student_number
FROM public.profiles
WHERE role = 'student'
  AND student_number = 'STU001';

-- 3) Optional: create a view for "enrollable students" (run once in SQL Editor)
-- Then the app or reports can use: SELECT * FROM enrollable_students;
/*
CREATE OR REPLACE VIEW public.enrollable_students AS
SELECT id, full_name, student_number, email
FROM public.profiles
WHERE role = 'student'
  AND student_number IS NOT NULL
  AND student_number != '';

-- Grant read to authenticated users (instructors can already read profiles)
GRANT SELECT ON public.enrollable_students TO authenticated;
*/

-- 4) Optional: enforce in DB that grades only reference valid students (trigger)
-- This prevents inserting a grade with student_number that doesn't exist in profiles.
-- Run only if you want strict DB-level validation.
/*
CREATE OR REPLACE FUNCTION public.check_grade_student_exists()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.student_profile_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.student_profile_id AND role = 'student') THEN
      RAISE EXCEPTION 'student_profile_id must reference a student profile';
    END IF;
  END IF;
  IF NEW.student_profile_id IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE student_number = NEW.student_number AND role = 'student') THEN
      RAISE EXCEPTION 'No student found with student_number %. Student must be registered first.', NEW.student_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_grade_student_exists ON public.grades;
CREATE TRIGGER check_grade_student_exists
  BEFORE INSERT ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.check_grade_student_exists();
*/
