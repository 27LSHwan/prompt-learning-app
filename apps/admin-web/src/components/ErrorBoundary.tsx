import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('Error caught by boundary:', error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg)',
          padding: 24,
        }}>
          <div className="card" style={{
            maxWidth: 480,
            padding: 40,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💥</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              관리자 화면에서 오류가 발생했습니다
            </h1>
            <p style={{
              fontSize: 14,
              color: 'var(--text-sub)',
              marginBottom: 24,
              lineHeight: 1.6,
            }}>
              {this.state.error?.message || '예상치 못한 오류가 발생했습니다. 페이지를 새로고침하세요.'}
            </p>
            <button
              onClick={this.handleReset}
              className="btn btn-primary"
              style={{ padding: '10px 22px' }}
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
