import { useToastState } from '../hooks/useToast';

const TOAST_STYLES = {
  success: {
    background: '#065f46',
    borderLeft: '4px solid #10b981',
    icon: '✅',
  },
  error: {
    background: '#991b1b',
    borderLeft: '4px solid #ef4444',
    icon: '❌',
  },
  info: {
    background: '#1e40af',
    borderLeft: '4px solid #3b82f6',
    icon: 'ℹ️',
  },
  warning: {
    background: '#92400e',
    borderLeft: '4px solid #f59e0b',
    icon: '⚠️',
  },
};

export default function Toast() {
  const { toasts, removeToast } = useToastState();

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => {
        const style = TOAST_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            style={{
              background: style.background,
              borderLeft: style.borderLeft,
              color: '#fff',
              padding: '12px 16px',
              borderRadius: 8,
              maxWidth: 360,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              animation: 'fadeIn 0.35s ease both',
              pointerEvents: 'auto',
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{style.icon}</span>
            <span style={{ flex: 1, fontSize: 14 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 16,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
