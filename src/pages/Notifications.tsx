import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { notificationService } from '../lib/notifications';
import type { Notification } from '../types';
import { Check, ExternalLink, Bell, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadNotifications(); }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    const data = await notificationService.getNotifications(user.id);
    setNotifications(data);
    setLoading(false);
  };

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await notificationService.markAsRead(id);
    if (success) setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const success = await notificationService.markAllAsRead(user.id);
    if (success) setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) notificationService.markAsRead(notification.id);
    if (notification.action_url) navigate(notification.action_url);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}
            title="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <Bell size={20} style={{ color: 'var(--text-muted)' }} />
          <h1 className="page-title">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllAsRead} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={14} /> Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>Loading notifications…</div>
      ) : notifications.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Bell size={32} className="empty-state-icon" />
            <div className="empty-state-title">No notifications</div>
            <div className="empty-state-text">You're all caught up! New notifications will appear here.</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '16px 20px', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                background: !n.is_read ? 'rgba(59,130,246,0.04)' : 'transparent',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                background: !n.is_read ? 'var(--blue)' : 'transparent',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14, fontWeight: !n.is_read ? 600 : 500, color: 'var(--text)' }}>
                    {n.title}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 12 }}>
                    {new Date(n.created_at || '').toLocaleDateString()} · {new Date(n.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{n.message}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                  {n.action_url && (
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      View details <ExternalLink size={12} />
                    </span>
                  )}
                  {!n.is_read && (
                    <button
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
