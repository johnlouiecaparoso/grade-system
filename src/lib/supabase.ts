import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export { supabaseUrl };

// Database types (match supabase/schema.sql)
export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'instructor';
  student_number: string | null;
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Section = {
  id: string;
  year: string;
  section: string;
  student_count: number;
  created_at?: string;
};

export type Subject = {
  id: string;
  section_id: string;
  name: string;
  code: string;
  credits: number;
  description: string;
  created_at?: string;
};

export type Grade = {
  id: string;
  subject_id: string;
  student_profile_id: string | null;
  student_name: string;
  student_number: string;
  quizzes: number;
  summative: number;
  midterm: number;
  final: number;
  total_grade: number;
  created_at?: string;
  updated_at?: string;
};
