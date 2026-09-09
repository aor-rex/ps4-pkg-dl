import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ui]', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex flex-col items-center justify-center py-20"
          style={{ padding: '80px 24px', textAlign: 'center' }}
        >
          <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Something went wrong here
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px', maxWidth: '420px' }}>
            {this.state.error.message || 'Unexpected render error'}
          </p>
          <button
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--text-on-accent)',
              fontSize: '14px',
              fontWeight: 600,
              padding: '10px 24px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Back to Browse
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
