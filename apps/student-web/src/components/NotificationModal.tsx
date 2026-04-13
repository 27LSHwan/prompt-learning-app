import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Character, Emotion } from './Character';

interface Notification {
  id: string;
  type: string;
  message: string;
  dropout_type: string | null;
  created_at: string;
  is_read: boolean;
}

interface NotificationModalProps {
  studentId: string;
  onClose: () => void;
}

const DROPOUT_EMOTION: Record<string, Emotion> = {
  cognitive: 'thinking',
  motivational: 'encouraging',
  strategic: 'thinking',
  sudden: 'concerned',
  dependency: 'thinking',
  compound: 'concerned',
};

const TYPE_LABEL: Record<string, string> = {
  message: '💬 메시지',
  meeting: '🤝 면담 요청',
  resource: '📚 학습 자료',
  alert: '⚠️ 긴급 알림',
};

export const NotificationModal: React.FC<NotificationModalProps> = ({ studentId, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get<{ items: Notification[]; unread_count: number }>(
          '/student/notifications'
        );
        const unread = (res.data.items as Notification[]).filter(n => !n.is_read);
        setNotifications(unread);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, [studentId]);

  const current = notifications[currentIdx];

  const handleMarkRead = async () => {
    if (!current || marking) return;
    setMarking(true);
    try {
      await api.patch(`/student/notifications/${current.id}/read`);
    } catch {
      /* ignore */
    }
    if (currentIdx < notifications.length - 1) {
      setCurrentIdx(i => i + 1);
    } else {
      onClose();
    }
    setMarking(false);
  };

  const emotion: Emotion = current?.dropout_type
    ? (DROPOUT_EMOTION[current.dropout_type] || 'encouraging')
    : 'encouraging';

  if (loading) return null;
  if (!notifications.length) {
    onClose();
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--card)',
        borderRadius: '24px',
        padding: '32px',
        maxWidth: '440px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(91,76,255,0.2)',
        border: '2px solid #C5BEFF',
        animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <style>{`
          @keyframes popIn {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <span style={{
            display: 'inline-block',
            background: '#EDE9FF',
            color: '#5B4CFF',
            borderRadius: '20px',
            padding: '4px 14px',
            fontSize: '12px',
            fontWeight: 700,
          }}>
            {current.type ? TYPE_LABEL[current.type] || current.type : '💬 메시지'}
          </span>
          {notifications.length > 1 && (
            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-sub)' }}>
              {currentIdx + 1} / {notifications.length}
            </span>
          )}
        </div>

        {/* Character + message */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '16px 0' }}>
          <Character emotion={emotion} size={100} animate />
          <div style={{
            background: emotion === 'concerned' ? '#FFF8ED' : '#F0EDFF',
            border: `2px solid ${emotion === 'concerned' ? '#FFD08A' : '#C5BEFF'}`,
            borderRadius: '16px',
            padding: '16px 20px',
            width: '100%',
            boxSizing: 'border-box',
          }}>
            <p style={{
              margin: '0 0 4px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#8B7FFF',
            }}>프롬이가 전합니다 💌</p>
            <p style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.7',
              color: 'var(--text)',
            }}>
              {current.message}
            </p>
          </div>
        </div>

        {/* Time */}
        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-sub)', margin: '0 0 16px' }}>
          {new Date(current.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleMarkRead}
            disabled={marking}
            style={{
              flex: 1,
              padding: '12px',
              background: 'linear-gradient(135deg, #5B4CFF, #8B7FFF)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            {marking ? '...' : currentIdx < notifications.length - 1 ? '다음 메시지 →' : '확인했어요! 💪'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '12px 16px',
              background: 'var(--bg)',
              color: 'var(--text-sub)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
};
