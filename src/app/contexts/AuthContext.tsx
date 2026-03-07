import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/supabase';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'instructor';
  studentId: string | null;
};

type AuthContextType = {
  user: AuthUser | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, meta: { full_name: string; role: 'student' | 'instructor'; student_number?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function profileToAuthUser(p: Profile): AuthUser {
  return {
    id: p.id,
    email: p.email,
    name: p.full_name,
    role: p.role,
    studentId: p.student_number ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('Profile fetch error:', error.message, error.code, error.details);
      return null;
    }
    setProfile(data as Profile);
    return data as Profile;
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) await fetchProfile(u.id);
  }, [fetchProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).then(() => setLoading(false));
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error ?? null };
    if (data.session && data.user) {
      setSession(data.session);
      await fetchProfile(data.user.id);
    }
    return { error: null };
  }, [fetchProfile]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    meta: { full_name: string; role: 'student' | 'instructor'; student_number?: string }
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: meta.full_name,
          role: meta.role,
          student_number: meta.student_number ?? null,
        },
      },
    });
    return { error: error ?? null };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // If server signOut fails (e.g. 403), clear session locally so the app shows logged-out state
    }
    setSession(null);
    setProfile(null);
  }, []);

  const user: AuthUser | null = profile ? profileToAuthUser(profile) : null;

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
