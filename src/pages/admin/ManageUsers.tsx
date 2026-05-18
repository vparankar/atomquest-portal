import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';
import { Users, Search, Edit2, Check, X, Loader2 } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Product'];
const ROLES: Profile['role'][] = ['employee', 'manager', 'admin'];

export function ManageUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ role: Profile['role']; department: string; manager_id: string }>({
    role: 'employee', department: '', manager_id: ''
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setProfiles(data || []);
      setManagers((data || []).filter(p => p.role === 'manager' || p.role === 'admin'));
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  const startEdit = (profile: Profile) => {
    setEditingId(profile.id);
    setEditData({
      role: profile.role,
      department: profile.department || '',
      manager_id: profile.manager_id || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    setSavingId(id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: editData.role,
          department: editData.department || null,
          manager_id: editData.manager_id || null,
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setProfiles(prev => prev.map(p =>
        p.id === id
          ? { ...p, role: editData.role, department: editData.department || undefined, manager_id: editData.manager_id || undefined }
          : p
      ));
      setEditingId(null);
      toast.success('User updated successfully');

      // Refresh managers list in case role changed
      const updated = profiles.map(p => p.id === id ? { ...p, role: editData.role } : p);
      setManagers(updated.filter(p => p.role === 'manager' || p.role === 'admin'));
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update user: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const filtered = profiles.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q)
    );
  });

  const getManagerName = (managerId?: string) => {
    if (!managerId) return '—';
    const mgr = profiles.find(p => p.id === managerId);
    return mgr?.full_name || managerId.slice(0, 8) + '...';
  };

  if (loading) return <div className="p-8"><Spinner /></div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Manage Users</h1>
        <p className="mt-2 text-sm text-gray-500">View and manage user roles, departments, and reporting structure.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {ROLES.map(role => {
          const count = profiles.filter(p => p.role === role).length;
          const colors = {
            employee: 'from-blue-500 to-indigo-600',
            manager: 'from-emerald-500 to-teal-600',
            admin: 'from-purple-500 to-violet-600',
          };
          return (
            <div key={role} className={`bg-gradient-to-br ${colors[role]} rounded-xl p-5 text-white shadow-lg`}>
              <p className="text-sm font-medium opacity-80 capitalize">{role}s</p>
              <p className="text-3xl font-extrabold mt-1">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, department, or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Manager</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <Users className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                    <p>No users found.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors">
                      {/* User */}
                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">{p.full_name || 'Unnamed'}</div>
                        <div className="text-xs text-gray-400">{p.id.slice(0, 12) + '...'}</div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <select
                            value={editData.role}
                            onChange={e => setEditData(prev => ({ ...prev, role: e.target.value as Profile['role'] }))}
                            className="w-full rounded border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                          </select>
                        ) : (
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize
                            ${p.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                              p.role === 'manager' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-blue-100 text-blue-700'}`}
                          >
                            {p.role}
                          </span>
                        )}
                      </td>

                      {/* Department */}
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <select
                            value={editData.department}
                            onChange={e => setEditData(prev => ({ ...prev, department: e.target.value }))}
                            className="w-full rounded border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="">None</option>
                            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        ) : (
                          <span className="text-gray-700">{p.department || '—'}</span>
                        )}
                      </td>

                      {/* Manager */}
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <select
                            value={editData.manager_id}
                            onChange={e => setEditData(prev => ({ ...prev, manager_id: e.target.value }))}
                            className="w-full rounded border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="">None</option>
                            {managers.filter(m => m.id !== p.id).map(m => (
                              <option key={m.id} value={m.id}>{m.full_name || m.id.slice(0, 8)}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-700">{getManagerName(p.manager_id)}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                            <button
                              onClick={() => saveEdit(p.id)}
                              disabled={savingId === p.id}
                              className="p-1.5 rounded text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                              title="Save"
                            >
                              {savingId === p.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(p)}
                            className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors"
                          >
                            <Edit2 size={14} />
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
