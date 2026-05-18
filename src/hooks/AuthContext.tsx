import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: Profile['role'] | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Profile['role'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProfile(userId: string) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (mounted && data) {
          setProfile(data);
          setRole(data.role);
        }
      } catch {
        // Profile fetch failed — still allow loading to finish
      }
    }

    // Single source of truth: onAuthStateChange handles EVERYTHING,
    // including the INITIAL_SESSION event that fires immediately on subscribe.
    // IMPORTANT: Do NOT await async work inside this callback — Supabase JS v2
    // blocks signInWithPassword resolution until onAuthStateChange returns.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // Fetch profile in the background — don't block the auth callback
          loadProfile(currentUser.id).finally(() => {
            if (mounted) setLoading(false);
          });
        } else {
          setProfile(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    // Safety timeout — if auth never resolves (network issues, etc.),
    // stop showing the loading screen after 5 seconds
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
