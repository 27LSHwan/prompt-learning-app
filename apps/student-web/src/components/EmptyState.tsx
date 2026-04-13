interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
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
      padding: '60px 40px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 52, marginBottom: 20 }}>{icon}</div>
      <h3 style={{
        fontSize: 18,
        fontWeight: 700,
        color: 'var(--text)',
        marginBottom: 8,
      }}>
        {title}
      </h3>
      {description && (
        <p style={{
          color: 'var(--text-sub)',
          fontSize: 14,
          marginBottom: action ? 24 : 0,
          maxWidth: 320,
        }}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn btn-primary"
          style={{ padding: '10px 24px' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
