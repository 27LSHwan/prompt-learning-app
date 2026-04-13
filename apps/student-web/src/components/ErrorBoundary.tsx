import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          padding: '20px',
        }}>
          <div
            className="card"
            style={{
              maxWidth: 480,
              textAlign: 'center',
              padding: '40px',
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 20 }}>💥</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
              문제가 발생했습니다
            </h2>
            {this.state.error && (
              <div style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 13,
                textAlign: 'left',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
              }}>
                {this.state.error.message}
              </div>
            )}
            <p style={{ color: 'var(--text-sub)', marginBottom: 24, fontSize: 14 }}>
              페이지를 새로고침하여 다시 시도해주세요.
            </p>
            <button
              onClick={this.handleRefresh}
              className="btn btn-primary"
              style={{ padding: '11px 24px' }}
            >
              🔄 새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
