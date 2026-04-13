import { createPortal } from 'react-dom';

export interface ConfirmDialogProps {
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

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 500 }}>
      <div
        className="card"
        style={{
          width: 400,
          padding: 28,
          borderRadius: 16,
        }}
      >
        <h2 style={{
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 12,
          color: 'var(--text)',
        }}>
          {title}
        </h2>
        <p style={{
          fontSize: 14,
          color: 'var(--text-sub)',
          marginBottom: 24,
          lineHeight: 1.6,
        }}>
          {message}
        </p>
        <div style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onCancel}
            className="btn btn-ghost"
            style={{ padding: '9px 20px' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="btn btn-primary"
            style={{
              padding: '9px 20px',
              background: variant === 'danger' ? '#ef4444' : 'var(--primary)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
