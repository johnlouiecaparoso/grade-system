# Supabase setup for College Grade System

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. In **Project Settings → API**, copy:
   - **Project URL** → use as `VITE_SUPABASE_URL`
   - **anon public** key → use as `VITE_SUPABASE_ANON_KEY`

## 2. Environment variables

Create a `.env` file in the project root (see `.env.example`):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run the database schema

1. In Supabase Dashboard, open **SQL Editor**.
2. Open `supabase/schema.sql` in this repo and copy its full contents.
3. Paste into a new query and click **Run**.

If you already have an existing database, also run the migration in `supabase/migrations/add_subject_invites.sql`.

This creates:

- **profiles** – linked to auth users (role: student | instructor, student_number)
- **sections** – year + section name + student_count
- **subjects** – per section (name, code, credits, description)
- **grades** – per subject/student (quizzes, summative, midterm, final, total_grade)
- Row Level Security (RLS) and a trigger to create a profile on sign-up

## 4. Auth settings (optional)

- In **Authentication → Providers**, Email is enabled by default.
- If you want sign-in without email confirmation: **Authentication → Providers → Email** → turn off **Confirm email**.

## 5. Run the app

```bash
pnpm install
pnpm dev
```

Register as **Instructor** or **Student**, then sign in. Instructors manage sections, subjects, and grades; students see their own grades (by profile or by student number).

---

## Troubleshooting: 500 on signup or profile fetch

If you see **500** on `/auth/v1/signup` or on `/rest/v1/profiles`, Supabase is failing on the server. Common causes:

### 1. Schema not run or only partially run

- In Supabase Dashboard go to **SQL Editor** and run the **entire** `supabase/schema.sql` (from the top, in one go).
- Then go to **Table Editor** and confirm you see tables: **profiles**, **sections**, **subjects**, **grades**.

### 2. Trigger on `auth.users` failed

The trigger that creates a row in `profiles` when someone signs up must exist. In **SQL Editor** run:

```sql
-- Check if trigger exists (optional)
SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass;
```

If you don’t see `on_auth_user_created`, run the first part of the schema again (only the `profiles` table + `handle_new_user` function + trigger). Example:

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'instructor')),
  student_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
```

### 3. See the real error in Supabase

- **Logs**: Dashboard → **Logs** → choose “Postgres” or “API” and look for errors around the time of signup or profile request.
- **API logs**: Sometimes the response body of the failed request shows the actual Postgres or API error message.
