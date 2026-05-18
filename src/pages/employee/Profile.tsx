import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Profile as ProfileType } from '../../types';
import { UserCircle, Save, Mail, Shield, Users, CalendarDays } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

export function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [managerName, setManagerName] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user?.id]);

  async function loadProfile() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      setProfile(data);
      setFullName(data.full_name || '');
      setDepartment(data.department || '');

      // Fetch manager name if assigned
      if (data.manager_id) {
        const { data: mgr } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.manager_id)
          .single();
        setManagerName(mgr?.full_name || null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          department: department.trim() || null,
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Profile updated successfully');
      setProfile(prev => prev ? { ...prev, full_name: fullName.trim(), department: department.trim() || undefined } : null);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = profile && (fullName !== (profile.full_name || '') || department !== (profile.department || ''));

  if (loading) return <div className="p-8"><Spinner /></div>;
  if (!profile) return <div className="p-8 text-center text-red-500">Could not load profile.</div>;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Profile</h1>
        <p className="mt-2 text-sm text-gray-500">View and manage your personal information.</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Avatar Banner */}
        <div className="h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        <div className="px-8 pb-8">
          {/* Avatar */}
          <div className="-mt-16 mb-6">
            <div className="w-28 h-28 bg-white rounded-2xl shadow-lg border-4 border-white flex items-center justify-center">
              <UserCircle className="w-20 h-20 text-indigo-400" strokeWidth={1} />
            </div>
          </div>

          {/* Read-only info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <Mail size={18} className="text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</p>
                <p className="text-sm font-medium text-gray-900">{user?.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <Shield size={18} className="text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Role</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{profile.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <Users size={18} className="text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</p>
                <p className="text-sm font-medium text-gray-900">{managerName || 'Not assigned'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <CalendarDays size={18} className="text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Member Since</p>
                <p className="text-sm font-medium text-gray-900">
                  {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="border-t border-gray-100 pt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Edit Profile</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Select department</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="Operations">Operations</option>
                  <option value="Product">Product</option>
                </select>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold
                  bg-indigo-600 text-white shadow-sm hover:bg-indigo-700
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                  disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
