interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const confirmBg = variant === 'danger' ? '#ef4444' : 'var(--primary)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 28,
          borderRadius: 16,
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 12,
          color: 'var(--text)',
        }}>
          {title}
        </h3>
        <p style={{
          color: 'var(--text-sub)',
          marginBottom: 28,
          fontSize: 14,
          lineHeight: 1.6,
        }}>
          {message}
        </p>
        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onCancel}
            className="btn btn-ghost"
            style={{ padding: '10px 20px' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="btn"
            style={{
              padding: '10px 20px',
              background: confirmBg,
              color: '#fff',
              fontWeight: 700,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
