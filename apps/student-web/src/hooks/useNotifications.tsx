import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

export interface NotificationState {
  unreadCount: number;
  showModal: boolean;
  openModal: () => void;
  closeModal: () => void;
  refresh: () => void;
}

export function useNotifications(studentId: string | null, options: { autoOpen?: boolean } = {}): NotificationState {
  const autoOpen = options.autoOpen ?? true;
  const [unreadCount, setUnreadCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);

  const refresh = useCallback(async () => {
    if (!studentId) return;
    try {
      const res = await api.get<{ items: any[]; unread_count: number }>(
        '/student/notifications'
      );
      const count: number = res.data.unread_count ?? 0;
      setUnreadCount(count);
      // Auto-show modal on first check if there are unread notifications
      if (autoOpen && !checkedOnce && count > 0) {
        setShowModal(true);
      }
      setCheckedOnce(true);
    } catch {
      // ignore errors silently
    }
  }, [studentId, checkedOnce, autoOpen]);

  useEffect(() => {
    refresh();
    // Poll every 60 seconds
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    unreadCount,
    showModal,
    openModal: () => setShowModal(true),
    closeModal: () => {
      setShowModal(false);
      refresh();
    },
    refresh,
  };
}
