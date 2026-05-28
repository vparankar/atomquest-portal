import { useState, useEffect, useRef } from 'react';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { notificationService } from '../lib/notifications';
import type { Notification } from '../types';
import { supabase } from '../lib/supabase';

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadNotifications();

      const channel = supabase
        .channel(`notifications-${user.id}-${Math.random()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const newNotification = payload.new as Notification;
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    if (!user) return;
    const data = await notificationService.getNotifications(user.id);
    setNotifications(data);
    setUnreadCount(data.filter(n => !n.is_read).length);
  };

  const handleMarkAsRead = async (id: string) => {
    const success = await notificationService.markAsRead(id);
    if (success) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    const success = await notificationService.markAllAsRead(user.id);
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) handleMarkAsRead(notification.id);
    if (notification.action_url) { navigate(notification.action_url); setIsOpen(false); }
  };

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative', padding: 8, background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '50%',
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            minWidth: 18, height: 18, padding: '0 5px',
            fontSize: 10, fontWeight: 700, lineHeight: '18px',
            color: '#fff', background: 'var(--red)', borderRadius: 10,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transform: 'translate(4px, -4px)',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', right: 0, marginTop: 8, width: 340,
          background: 'var(--surface)', borderRadius: 'var(--radius-md)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)', overflow: 'hidden',
          zIndex: 50, border: '1px solid var(--border)',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', background: 'var(--surface-raised)',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                style={{
                  fontSize: 11, fontWeight: 500, color: 'var(--blue)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Check size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: !n.is_read ? 'rgba(59,130,246,0.04)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: !n.is_read ? 600 : 500, color: 'var(--text)' }}>
                      {n.title}
                    </span>
                    {!n.is_read && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: 5 }} />
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 6px' }}>{n.message}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>{new Date(n.created_at || '').toLocaleDateString()}</span>
                    {n.action_url && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--blue)' }}>
                        View <ExternalLink size={10} />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 16px', textAlign: 'center',
            background: 'var(--surface-raised)', borderTop: '1px solid var(--border)',
          }}>
            <button
              onClick={() => { navigate('/notifications'); setIsOpen(false); }}
              style={{
                fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
