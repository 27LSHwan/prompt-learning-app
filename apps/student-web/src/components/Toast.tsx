import { useToast, type ToastType } from '../hooks/useToast';

const TOAST_CONFIG: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: '#065f46', border: '#10b981', icon: '✅' },
  error: { bg: '#991b1b', border: '#ef4444', icon: '❌' },
  info: { bg: '#1e40af', border: '#3b82f6', icon: 'ℹ️' },
  warning: { bg: '#92400e', border: '#f59e0b', icon: '⚠️' },
};

export default function Toast() {
  const { toasts, removeToast } = useToast();

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {toasts.map(toast => {
        const cfg = TOAST_CONFIG[toast.type];
        return (
          <div
            key={toast.id}
            style={{
              background: cfg.bg,
              borderLeft: `4px solid ${cfg.border}`,
              color: '#fff',
              padding: '12px 16px',
              borderRadius: 8,
              maxWidth: 360,
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              animation: 'slideUp 0.3s ease both',
            }}
          >
            <span style={{ fontSize: 18 }}>{cfg.icon}</span>
            <span style={{ flex: 1, fontSize: 14 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 18,
                padding: 0,
                opacity: 0.7,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
