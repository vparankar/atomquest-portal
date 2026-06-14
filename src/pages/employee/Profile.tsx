import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useProfile, useManagerProfile, useUpdateProfile } from '../../hooks/queries';
import { UserCircle, Save, Mail, Shield, Users, CalendarDays, Eye, EyeOff } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

const DEPTS = ['Product Engineering', 'People & Operations', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Product'];

export function Profile() {
  const { user } = useAuth();
  
  const { data: profile, isLoading: isProfileLoading, error: profileError } = useProfile(user?.id);
  const { data: manager } = useManagerProfile(profile?.manager_id);
  const updateProfile = useUpdateProfile();

  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const { toast } = useToast();

  // Initialize form state when profile data loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setDepartment(profile.department || '');
    }
  }, [profile]);
  const handleSave = async () => {
    if (!user) return;
    
    updateProfile.mutate(
      { userId: user.id, updates: { full_name: fullName.trim(), department: department.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success('Profile updated');
        },
        onError: (err: any) => {
          toast.error('Failed: ' + err.message);
        }
      }
    );
  };

  const hasChanges = profile && (fullName !== (profile.full_name || '') || department !== (profile.department || ''));

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      // Verify old password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: oldPassword,
      });
      if (signInError) {
        toast.error('Current password is incorrect');
        setChangingPassword(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err: any) {
      toast.error('Failed to update password: ' + err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const canUpdatePassword = oldPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;

  if (isProfileLoading) return <div style={{ padding: 32 }}><Spinner /></div>;
  if (profileError || !profile) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--red)' }}>Could not load profile.</div>;

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
          <div className="profile-form-grid" style={{ gap: 10, marginBottom: 24 }}>
            {[
              { icon: <Mail size={15} style={{ color: 'var(--text-muted)' }} />,         label: 'Email',         val: user?.email || '—'  },
              { icon: <Shield size={15} style={{ color: 'var(--text-muted)' }} />,       label: 'Role',          val: profile.role         },
              { icon: <Users size={15} style={{ color: 'var(--text-muted)' }} />,        label: 'Manager',       val: manager?.full_name || 'Not assigned' },
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
            <button onClick={handleSave} disabled={updateProfile.isPending || !hasChanges} className="btn btn-primary" style={{ gap: 6 }}>
              <Save size={14} />
              {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><span className="card-title">Change Password</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="form-label">Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                  tabIndex={-1}
                >
                  {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !canUpdatePassword}
              className="btn btn-primary"
              style={{ gap: 6 }}
            >
              <Save size={14} />
              {changingPassword ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
