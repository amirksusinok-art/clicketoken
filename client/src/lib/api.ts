const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:3001');

export function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Telegram WebApp initData
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.initData) {
    headers['x-telegram-init-data'] = tg.initData;
  }

  // Dev user ID fallback for browser development
  const devId = localStorage.getItem('clicketoken_dev_user_id');
  if (devId) {
    headers['x-dev-user-id'] = devId;
  }

  return headers;
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    ...getHeaders(),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Произошла ошибка при выполнении запроса');
  }

  return data as T;
}

export { API_BASE };
