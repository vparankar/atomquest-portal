import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';
import { Users, Search, Edit2, Check, X, Loader2 } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Product'];
const ROLES: Profile['role'][] = ['employee', 'manager', 'admin'];

const ROLE_BADGE: Record<string, string> = {
  admin:    'badge badge-purple',
  manager:  'badge badge-green',
  employee: 'badge badge-blue',
};

export function ManageUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ role: Profile['role']; department: string; manager_id: string }>({ role: 'employee', department: '', manager_id: '' });
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchProfiles(); }, []);

  async function fetchProfiles() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      setProfiles(data || []);
      setManagers((data || []).filter(p => p.role === 'manager' || p.role === 'admin'));
    } catch { toast.error('Failed to load users'); } finally { setLoading(false); }
  }

  const startEdit = (p: Profile) => {
    setEditingId(p.id);
    setEditData({ role: p.role, department: p.department || '', manager_id: p.manager_id || '' });
  };

  const saveEdit = async (id: string) => {
    setSavingId(id);
    try {
      const { error } = await supabase.from('profiles').update({ role: editData.role, department: editData.department || null, manager_id: editData.manager_id || null }).eq('id', id);
      if (error) throw error;
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...editData } : p));
      setEditingId(null);
      toast.success('User updated');
      const updated = profiles.map(p => p.id === id ? { ...p, role: editData.role } : p);
      setManagers(updated.filter(p => p.role === 'manager' || p.role === 'admin'));
    } catch (err: any) { toast.error('Failed: ' + err.message); } finally { setSavingId(null); }
  };

  const filtered = profiles.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.full_name?.toLowerCase().includes(q) || p.department?.toLowerCase().includes(q) || p.role.includes(q);
  });

  const getManagerName = (id?: string) => {
    if (!id) return '—';
    return profiles.find(p => p.id === id)?.full_name || id.slice(0, 8) + '…';
  };

  if (loading) return <div style={{ padding: 32 }}><Spinner /></div>;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Manage Users</h1>
        <p className="page-subtitle">View and edit user roles, departments, and reporting structure.</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {ROLES.map(role => {
          const count = profiles.filter(p => p.role === role).length;
          const icons: Record<string, string> = { employee: '👤', manager: '👥', admin: '🔐' };
          return (
            <div key={role} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, border: '1px solid var(--border)' }}>{icons[role]}</div>
              <div>
                <div className="stat-value" style={{ fontSize: 22 }}>{count}</div>
                <div className="stat-label">{role}s</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <div className="search-input-wrapper" style={{ width: '100%', maxWidth: 360 }}>
          <Search size={15} className="search-icon" />
          <input className="search-input" style={{ width: '100%' }} type="text" placeholder="Search by name, department or role…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Department</th>
                <th>Manager</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <Users size={32} className="empty-state-icon" />
                    <div className="empty-state-title">No users found</div>
                  </div>
                </td></tr>
              ) : filtered.map(p => {
                const isEditing = editingId === p.id;
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.full_name || 'Unnamed'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.id.slice(0, 12)}…</div>
                    </td>
                    <td>
                      {isEditing ? (
                        <select value={editData.role} onChange={e => setEditData(d => ({ ...d, role: e.target.value as Profile['role'] }))} className="form-select" style={{ width: 'auto' }}>
                          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                        </select>
                      ) : <span className={ROLE_BADGE[p.role]}>{p.role}</span>}
                    </td>
                    <td>
                      {isEditing ? (
                        <select value={editData.department} onChange={e => setEditData(d => ({ ...d, department: e.target.value }))} className="form-select" style={{ width: 'auto' }}>
                          <option value="">None</option>
                          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      ) : <span style={{ color: 'var(--text-secondary)' }}>{p.department || '—'}</span>}
                    </td>
                    <td>
                      {isEditing ? (
                        <select value={editData.manager_id} onChange={e => setEditData(d => ({ ...d, manager_id: e.target.value }))} className="form-select" style={{ width: 'auto' }}>
                          <option value="">None</option>
                          {managers.filter(m => m.id !== p.id).map(m => <option key={m.id} value={m.id}>{m.full_name || m.id.slice(0, 8)}</option>)}
                        </select>
                      ) : <span style={{ color: 'var(--text-secondary)' }}>{getManagerName(p.manager_id)}</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button onClick={() => setEditingId(null)} className="btn btn-secondary btn-sm"><X size={14} /></button>
                          <button onClick={() => saveEdit(p.id)} disabled={savingId === p.id} className="btn btn-primary btn-sm">
                            {savingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '4px 10px', cursor: 'pointer' }}>
                          <Edit2 size={12} /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
