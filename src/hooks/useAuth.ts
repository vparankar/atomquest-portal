import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Profile['role'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      setUser(session?.user || null);
      
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (mounted) {
          if (data) {
            setProfile(data);
            setRole(data.role);
          }
        }
      } else {
        if (mounted) {
          setProfile(null);
          setRole(null);
        }
      }
      if (mounted) setLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      
      setUser(session?.user || null);
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (mounted) {
          if (data) {
            setProfile(data);
            setRole(data.role);
          }
        }
      } else {
        if (mounted) {
          setProfile(null);
          setRole(null);
        }
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, role, loading };
}
