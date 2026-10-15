import React, { useEffect, useRef } from 'react';
import { useAppStore } from './store/useAppStore';
import { api } from './services/api';
import { soundFx } from './services/audio';
import { notifService } from './services/notifications';
import { useKeyboardShortcuts } from './services/shortcuts';
import { useSwipeNavigation } from './services/swipe';

// Core components
import { Navbar } from './components/Navbar';
import { TickerMarquee } from './components/TickerMarquee';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/ToastContainer';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { ShortcutsModal } from './components/ShortcutsModal';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { SignalsPage } from './pages/SignalsPage';
import { ChartsPage } from './pages/ChartsPage';
import { NewsPage } from './pages/NewsPage';
import { CalendarPage } from './pages/CalendarPage';
import { RiskPage } from './pages/RiskPage';
import { HistoryPage } from './pages/HistoryPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { AdminPage } from './pages/AdminPage';
import { ProfilePage } from './pages/ProfilePage';

// Mobile nav icons
import { LayoutDashboard, Zap, LineChart, Calculator, User } from 'lucide-react';

// ── Page transition wrapper ──────────────────────────────────
const PageWrapper: React.FC<{ children: React.ReactNode; tabKey: string }> = ({ children, tabKey }) => (
  <div key={tabKey} className="page-enter w-full min-w-0">
    {children}
  </div>
);

export const App: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setQuotes,
    setSignals,
    setNews,
    setCalendar,
    setProviderHealth,
    addSignal,
    addToast,
    notificationsGranted,
    setNotificationsGranted,
    quotes,
    darkMode,
  } = useAppStore();

  // ── Global hooks ────────────────────────────────────────────
  useKeyboardShortcuts();
  useSwipeNavigation();

  // ── Dark mode class on <html> ────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', !darkMode);
  }, [darkMode]);

  // ── Request notifications on first load ──────────────────────
  useEffect(() => {
    if (!notificationsGranted && 'Notification' in window && Notification.permission === 'default') {
      // Delay 5s so user is settled on the page
      const t = setTimeout(async () => {
        const granted = await notifService.requestPermission();
        if (granted) setNotificationsGranted(true);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initial Data Fetch ────────────────────────────────────────
  useEffect(() => {
    api.getQuotes().then(setQuotes).catch(() => {});
    api.getSignals().then(setSignals).catch(() => {});
    api.getNews().then(setNews).catch(() => {});
    api.getCalendar().then(setCalendar).catch(() => {});
    api.getMarketHealth().then(setProviderHealth).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Price Alert Checker (runs on every quote update) ────────
  const alertsRef = useRef<{ symbol: string; targetPrice: number; condition: 'ABOVE' | 'BELOW'; id: string }[]>([]);
  const setAlertsRef = (alerts: typeof alertsRef.current) => { alertsRef.current = alerts; };
  // Expose setter so WatchlistPage can register alerts
  (window as any).__fspRegisterAlerts = setAlertsRef;

  useEffect(() => {
    const qList = Object.values(quotes);
    qList.forEach((q) => {
      alertsRef.current.forEach((alert) => {
        if (alert.symbol !== q.symbol) return;
        const triggered =
          (alert.condition === 'ABOVE' && q.mid >= alert.targetPrice) ||
          (alert.condition === 'BELOW' && q.mid <= alert.targetPrice);
        if (triggered) {
          soundFx.playAlertBell();
          addToast(`🔔 ${q.symbol} Alert`, `Price ${q.mid} hit your ${alert.condition} ${alert.targetPrice} target`, 'alert');
          notifService.send(`🔔 ${q.symbol} Price Alert`, `Hit your ${alert.condition} target at ${alert.targetPrice}`);
          notifService.hapticSignal();
          // Remove triggered alert
          alertsRef.current = alertsRef.current.filter((a) => a.id !== alert.id);
        }
      });
    });
  }, [quotes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket + Polling Fallback ──────────────────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const connectWs = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws/feed`);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'QUOTES_UPDATE' && Array.isArray(msg.data)) {
              setQuotes(msg.data);
            } else if (msg.type === 'NEW_SIGNAL' || msg.type === 'NEW_ADMIN_SIGNAL') {
              soundFx.playSignalChime();
              notifService.signalAlert(msg.data.symbol, msg.data.direction, msg.data.confidence);
              notifService.hapticSignal();
              addToast('New Trading Signal', `${msg.data.symbol} ${msg.data.direction} published!`, 'success');
              api.getSignals().then(setSignals);
            }
          } catch { /* parse error */ }
        };

        ws.onerror = () => ws?.close();
        ws.onclose = () => setTimeout(connectWs, 3000);
      } catch { /* ignore */ }
    };

    connectWs();

    // Polling fallback every 2.5s
    fallbackInterval = setInterval(() => {
      api.getQuotes().then(setQuotes).catch(() => {});
    }, 2500);

    return () => {
      ws?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#040711] text-slate-100 flex flex-col font-sans pb-16 lg:pb-0 relative selection:bg-cyan-500/20 selection:text-cyan-300" style={{overflowX:'clip'}}>
      {/* Ambient Lighting Mesh (Ultra-premium background depth) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-[15%] w-[600px] h-[600px] bg-cyan-500/[0.06] rounded-full blur-[140px]" />
        <div className="absolute top-[25%] -right-28 w-[550px] h-[550px] bg-blue-600/[0.05] rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] left-[25%] w-[700px] h-[700px] bg-emerald-500/[0.04] rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <TickerMarquee />

        <div className="flex-1 flex w-full max-w-[1680px] mx-auto min-w-0">
        <Sidebar />
        <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 pb-24">
          {activeTab === 'dashboard' && <PageWrapper tabKey="dashboard"><DashboardPage /></PageWrapper>}
          {activeTab === 'signals'   && <PageWrapper tabKey="signals"><SignalsPage /></PageWrapper>}
          {activeTab === 'charts'    && <PageWrapper tabKey="charts"><ChartsPage /></PageWrapper>}
          {activeTab === 'news'      && <PageWrapper tabKey="news"><NewsPage /></PageWrapper>}
          {activeTab === 'calendar'  && <PageWrapper tabKey="calendar"><CalendarPage /></PageWrapper>}
          {activeTab === 'risk'      && <PageWrapper tabKey="risk"><RiskPage /></PageWrapper>}
          {activeTab === 'history'   && <PageWrapper tabKey="history"><HistoryPage /></PageWrapper>}
          {activeTab === 'watchlist' && <PageWrapper tabKey="watchlist"><WatchlistPage /></PageWrapper>}
          {activeTab === 'admin'     && <PageWrapper tabKey="admin"><AdminPage /></PageWrapper>}
          {activeTab === 'profile'   && <PageWrapper tabKey="profile"><ProfilePage /></PageWrapper>}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 safe-bottom bg-[#070c1a]/98 backdrop-blur-xl border-t border-white/[0.07] z-50 flex items-center justify-around px-1">
        {([
          { id: 'dashboard', label: 'Overview', Icon: LayoutDashboard },
          { id: 'signals',   label: 'Signals',  Icon: Zap },
          { id: 'charts',    label: 'Charts',   Icon: LineChart },
          { id: 'risk',      label: 'Risk',     Icon: Calculator },
          { id: 'profile',   label: 'Account',  Icon: User },
        ] as const).map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id);
                if ('vibrate' in navigator) navigator.vibrate(15);
              }}
              className={`relative flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl text-[9px] font-bold tracking-wider uppercase transition-all duration-150 ${
                isActive ? 'text-cyan-400 mobile-nav-active' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Overlays & Modals */}
      <ToastContainer />
      <PWAInstallBanner />
      <ShortcutsModal />
      </div>
    </div>
  );
};
