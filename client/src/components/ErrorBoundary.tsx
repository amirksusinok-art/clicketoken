import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      window.location.href = window.location.href;
    }
  };

  private handleReset = () => {
    try {
      localStorage.removeItem('clicketoken_active_game');
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090c14] text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-3xl mb-4 shadow-lg shadow-rose-500/20 animate-pulse">
            ⚠️
          </div>

          <h1 className="text-xl font-black text-white uppercase tracking-wider mb-2">
            Произошла ошибка
          </h1>

          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            {this.state.error?.message || 'Приложение столкнулось с непредвиденной ошибкой отображения.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={this.handleReload}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 transition active:scale-95 cursor-pointer"
            >
              🔄 Перезагрузить
            </button>
            <button
              onClick={this.handleReset}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider border border-white/10 transition active:scale-95 cursor-pointer"
            >
              Сброс
            </button>
          </div>

          {this.state.error && (
            <details className="mt-6 text-left max-w-sm w-full bg-black/50 border border-white/10 rounded-xl p-3 text-[10px] text-slate-400 font-mono overflow-auto max-h-36">
              <summary className="cursor-pointer text-slate-300 font-bold mb-1">
                Подробности для разработчика
              </summary>
              <div className="whitespace-pre-wrap text-rose-300">
                {this.state.error.toString()}
              </div>
              {this.state.errorInfo?.componentStack && (
                <div className="whitespace-pre-wrap text-slate-500 mt-2">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
