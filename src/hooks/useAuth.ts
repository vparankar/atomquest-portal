import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Profile['role'] | null>(
    (localStorage.getItem('demo_role') as Profile['role']) || null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (data) {
          setProfile(data);
          if (!localStorage.getItem('demo_role')) {
            setRole(data.role);
          }
        }
      }
      setLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (data) {
          setProfile(data);
          if (!localStorage.getItem('demo_role')) {
            setRole(data.role);
          }
        }
      } else {
        setProfile(null);
        if (!localStorage.getItem('demo_role')) {
           setRole(null);
        }
      }
      setLoading(false);
    });

    const handleStorageChange = () => {
      const demoRole = localStorage.getItem('demo_role') as Profile['role'] | null;
      if (demoRole) {
        setRole(demoRole);
      } else if (profile) {
        setRole(profile.role);
      } else {
        setRole(null);
      }
    };

    window.addEventListener('demo_role_change', handleStorageChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('demo_role_change', handleStorageChange);
    };
  }, [profile]);

  return { user, profile, role, loading };
}
