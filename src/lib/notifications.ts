import { supabase } from './supabase';
import { sendNotificationEmail } from './emailService';
import type { Notification } from '../types';

export const notificationService = {
  async getNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
    return data as Notification[];
  },

  async markAsRead(notificationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
    return true;
  },
  
  async markAllAsRead(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
    return true;
  },

  async createNotification(notification: Omit<Notification, 'id' | 'created_at' | 'is_read'>): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .insert([notification]);

    if (error) {
      console.error('Error creating notification:', error);
      return false;
    }

    // Fire-and-forget: send email if enabled (never blocks UI)
    this._trySendEmail(notification);

    return true;
  },

  /** Internal: check if email is enabled, resolve recipient, and send. */
  async _trySendEmail(notification: Omit<Notification, 'id' | 'created_at' | 'is_read'>) {
    try {
      // Check system setting
      const { data: settings } = await supabase
        .from('system_settings')
        .select('email_enabled')
        .eq('id', 1)
        .maybeSingle();

      if (!settings?.email_enabled) return;

      // Resolve recipient name/role
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', notification.user_id)
        .maybeSingle();

      await sendNotificationEmail({
        title: notification.title,
        message: notification.message,
        recipientName: profile?.full_name || 'Unknown User',
        recipientRole: profile?.role || 'employee',
        notificationType: notification.type,
        actionUrl: notification.action_url,
      });
    } catch (err) {
      console.warn('Email dispatch failed (non-blocking):', err);
    }
  },
};
