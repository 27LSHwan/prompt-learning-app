export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 52,
        marginBottom: 16,
      }}>
        {icon}
      </div>
      <h2 style={{
        fontSize: 18,
        fontWeight: 700,
        color: 'var(--text)',
        marginBottom: 8,
      }}>
        {title}
      </h2>
      {description && (
        <p style={{
          fontSize: 14,
          color: 'var(--text-sub)',
          marginBottom: action ? 24 : 0,
          maxWidth: 360,
        }}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn btn-primary"
          style={{ padding: '10px 22px' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
