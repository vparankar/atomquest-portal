import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Profile as ProfileType } from '../../types';
import { UserCircle, Save, Mail, Shield, Users, CalendarDays } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

const DEPTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Product'];

export function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [managerName, setManagerName] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { if (user) loadProfile(); }, [user?.id]);

  async function loadProfile() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
      if (error) throw error;
      setProfile(data); setFullName(data.full_name || ''); setDepartment(data.department || '');
      if (data.manager_id) {
        const { data: mgr } = await supabase.from('profiles').select('full_name').eq('id', data.manager_id).single();
        setManagerName(mgr?.full_name || null);
      }
    } catch { toast.error('Failed to load profile'); } finally { setLoading(false); }
  }

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName.trim(), department: department.trim() || null }).eq('id', user.id);
      if (error) throw error;
      toast.success('Profile updated');
      setProfile(prev => prev ? { ...prev, full_name: fullName.trim(), department: department.trim() || undefined } : null);
    } catch (err: any) { toast.error('Failed: ' + err.message); } finally { setSaving(false); }
  };

  const hasChanges = profile && (fullName !== (profile.full_name || '') || department !== (profile.department || ''));

  if (loading) return <div style={{ padding: 32 }}><Spinner /></div>;
  if (!profile) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--red)' }}>Could not load profile.</div>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">View and manage your personal information.</p>
      </div>

      {/* Avatar header strip */}
      <div style={{ height: 6, background: 'var(--brand-yellow)', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }} />

      <div className="card" style={{ borderTop: 'none', borderRadius: '0 0 var(--radius-md) var(--radius-md)', marginBottom: 20 }}>
        <div className="card-body">
          {/* Avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 56, height: 56, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCircle size={36} style={{ color: 'var(--text-muted)' }} strokeWidth={1.2} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{profile.full_name || 'Unnamed User'}</div>
              <span className={`badge ${profile.role === 'admin' ? 'badge-purple' : profile.role === 'manager' ? 'badge-green' : 'badge-blue'}`} style={{ marginTop: 4 }}>{profile.role}</span>
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
            {[
              { icon: <Mail size={15} style={{ color: 'var(--text-muted)' }} />,         label: 'Email',         val: user?.email || '—'  },
              { icon: <Shield size={15} style={{ color: 'var(--text-muted)' }} />,       label: 'Role',          val: profile.role         },
              { icon: <Users size={15} style={{ color: 'var(--text-muted)' }} />,        label: 'Manager',       val: managerName || 'Not assigned' },
              { icon: <CalendarDays size={15} style={{ color: 'var(--text-muted)' }} />, label: 'Member Since',  val: profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ marginTop: 1 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', textTransform: item.label === 'Role' ? 'capitalize' : 'none' }}>{item.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="card">
        <div className="card-header"><span className="card-title">Edit Profile</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="form-label">Full Name</label>
              <input className="form-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter your full name" />
            </div>
            <div>
              <label className="form-label">Department</label>
              <select className="form-select" value={department} onChange={e => setDepartment(e.target.value)}>
                <option value="">Select department</option>
                {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} disabled={saving || !hasChanges} className="btn btn-primary" style={{ gap: 6 }}>
              <Save size={14} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
