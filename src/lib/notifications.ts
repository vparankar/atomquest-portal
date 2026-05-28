import { supabase } from './supabase';
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
    return true;
  }
};
