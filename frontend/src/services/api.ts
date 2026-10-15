import { Quote, Candle, TradingSignal, NewsArticle, EconomicEvent, User, PriceAlert, SignalPerformanceStats } from '../types';

const API_BASE = '/api/v1';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('fsp_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Authentication
  async register(data: { email: string; password: string; full_name?: string; timezone?: string }): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(err.detail || 'Registration failed');
    }
    return res.json();
  },

  async login(credentials: { email: string; password: string }): Promise<{ access_token: string; role: string; email: string; full_name?: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(err.detail || 'Invalid email or password');
    }
    const data = await res.json();
    localStorage.setItem('fsp_token', data.access_token);
    localStorage.setItem('fsp_role', data.role);
    localStorage.setItem('fsp_email', data.email);
    return data;
  },

  async getCurrentUser(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  },

  logout() {
    localStorage.removeItem('fsp_token');
    localStorage.removeItem('fsp_role');
    localStorage.removeItem('fsp_email');
  },

  // Market Data
  async getQuotes(): Promise<Quote[]> {
    const res = await fetch(`${API_BASE}/market/quotes`);
    if (!res.ok) throw new Error('Failed to load market quotes');
    return res.json();
  },

  async getCandles(symbol: string, timeframe: string = 'H1', count: number = 80): Promise<Candle[]> {
    const res = await fetch(`${API_BASE}/market/candles/${encodeURIComponent(symbol)}?timeframe=${timeframe}&count=${count}`);
    if (!res.ok) throw new Error(`Failed to load candles for ${symbol}`);
    return res.json();
  },

  async getMarketHealth(): Promise<{ provider_name: string; status: string; is_live: boolean; latency_ms: number }> {
    const res = await fetch(`${API_BASE}/market/health`);
    if (!res.ok) throw new Error('Failed to load provider health');
    return res.json();
  },

  // Signals
  async getSignals(filters?: { symbol?: string; status?: string; direction?: string; timeframe?: string }): Promise<TradingSignal[]> {
    const params = new URLSearchParams();
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.direction && filters.direction !== 'ALL') params.append('direction', filters.direction);
    if (filters?.timeframe && filters.timeframe !== 'ALL') params.append('timeframe', filters.timeframe);

    const res = await fetch(`${API_BASE}/signals/?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load signals');
    return res.json();
  },

  async triggerAutoScan(): Promise<TradingSignal[]> {
    const res = await fetch(`${API_BASE}/signals/auto-scan`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Auto-scan failed');
    return res.json();
  },

  async getPerformanceStats(): Promise<SignalPerformanceStats> {
    const res = await fetch(`${API_BASE}/signals/stats/performance`);
    if (!res.ok) throw new Error('Failed to load performance stats');
    return res.json();
  },

  // Admin Studio
  async publishAdminSignal(signalData: Partial<TradingSignal>): Promise<TradingSignal> {
    const res = await fetch(`${API_BASE}/admin/signals`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(signalData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to publish signal' }));
      throw new Error(err.detail || 'Failed to publish signal');
    }
    return res.json();
  },

  async updateSignal(id: number, data: { status?: string; stop_loss?: number; take_profit_1?: number }): Promise<TradingSignal> {
    const res = await fetch(`${API_BASE}/admin/signals/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update signal');
    return res.json();
  },

  // News & Calendar
  async getNews(category: string = 'ALL'): Promise<NewsArticle[]> {
    const res = await fetch(`${API_BASE}/news/?category=${category}`);
    if (!res.ok) throw new Error('Failed to load news');
    return res.json();
  },

  async getCalendar(timezone: string = 'Africa/Nairobi'): Promise<EconomicEvent[]> {
    const res = await fetch(`${API_BASE}/calendar/?timezone=${encodeURIComponent(timezone)}`);
    if (!res.ok) throw new Error('Failed to load economic calendar');
    return res.json();
  },

  // Risk Calculator
  async calculateRisk(req: {
    account_balance: number;
    account_currency: string;
    risk_percentage: number;
    symbol: string;
    entry_price: number;
    stop_loss_price: number;
    take_profit_price?: number;
    leverage?: number;
    spread_pips?: number;
  }) {
    const res = await fetch(`${API_BASE}/risk/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) throw new Error('Failed to calculate risk');
    return res.json();
  },

  // Price Alerts
  async getAlerts(): Promise<PriceAlert[]> {
    const res = await fetch(`${API_BASE}/alerts/`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return res.json();
  },

  async createAlert(alert: { symbol: string; target_price: number; condition: string; notes?: string }): Promise<PriceAlert> {
    const res = await fetch(`${API_BASE}/alerts/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(alert)
    });
    if (!res.ok) throw new Error('Failed to create alert');
    return res.json();
  }
};
