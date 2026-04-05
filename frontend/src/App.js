import './App.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import TestPage from './pages/TestPage';
import UploadPage from './pages/UploadPage';
import HistoryPage from './pages/HistoryPage';
import geminiLogo from './assets/gemini-logo.svg';
import { api } from './services/api';

const ACTIVE_TAB_STORAGE_KEY = 'activeTab';
const THEME_STORAGE_KEY = 'uiTheme';

const NAV_ITEMS = [
  {
    key: 'Dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4H10V10H4V4Z" stroke="currentColor" strokeWidth="2" />
        <path d="M14 4H20V10H14V4Z" stroke="currentColor" strokeWidth="2" />
        <path d="M4 14H10V20H4V14Z" stroke="currentColor" strokeWidth="2" />
        <path d="M14 14H20V20H14V14Z" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    key: 'Upload',
    label: 'Upload',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 15V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 8L12 4L16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 15V19H20V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'Test',
    label: 'Test',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 3H14L18 7V21H6V3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M14 3V7H18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken') || '');
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    const validTabKeys = NAV_ITEMS.map((item) => item.key);
    return validTabKeys.includes(savedTab) ? savedTab : 'Dashboard';
  });
  const [viewingHistory, setViewingHistory] = useState(false);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === 'dark' ? 'dark' : 'light';
  });

  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  const [dashboardNote, setDashboardNote] = useState('');
  const [dashboardNoteUpdatedAt, setDashboardNoteUpdatedAt] = useState(null);
  const [dashboardNoteSaving, setDashboardNoteSaving] = useState(false);
  const [dashboardNoteError, setDashboardNoteError] = useState('');

  const [tables, setTables] = useState([]);
  const [tableProgressByTable, setTableProgressByTable] = useState({});
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState('');

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const isLoggedIn = Boolean(authToken);

  const loadProtectedData = async () => {
    setAnalyticsLoading(true);
    setTablesLoading(true);
    setHistoryLoading(true);
    setAnalyticsError('');
    setDashboardNoteError('');
    setTablesError('');
    setHistoryError('');

    try {
      const [analyticsResult, noteResult, tablesResult, historyResult] = await Promise.allSettled([
        api.getAnalytics(),
        api.getDashboardNote(),
        api.listTestTables(),
        api.getTestHistory(),
      ]);

      if (analyticsResult.status === 'fulfilled') {
        setAnalytics(analyticsResult.value);
      } else {
        const message = analyticsResult.reason?.message || 'Failed to fetch analytics';
        setAnalyticsError(message);
      }

      if (noteResult.status === 'fulfilled') {
        setDashboardNote(noteResult.value?.note?.content || '');
        setDashboardNoteUpdatedAt(noteResult.value?.note?.updatedAt || null);
      }

      if (tablesResult.status === 'fulfilled') {
        setTables(tablesResult.value.tables || []);
        setTableProgressByTable(tablesResult.value.lastQuestionByTable || {});
      } else {
        const message = tablesResult.reason?.message || 'Failed to fetch test tables';
        setTablesError(message);
      }

      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value.history || []);
      } else {
        const message = historyResult.reason?.message || 'Failed to fetch history';
        setHistoryError(message);
      }

      if (noteResult.status === 'rejected') {
        setDashboardNoteError(noteResult.reason?.message || 'Failed to fetch dashboard note');
      }
    } catch (error) {
      const message = error.message || 'Failed to fetch protected data';
      setAnalyticsError(message);
      setDashboardNoteError(message);
      setTablesError(message);
      setHistoryError(message);
    } finally {
      setAnalyticsLoading(false);
      setTablesLoading(false);
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadProtectedData();
      return;
    }

    setAnalytics(null);
    setDashboardNote('');
    setDashboardNoteUpdatedAt(null);
    setDashboardNoteSaving(false);
    setDashboardNoteError('');
    setTables([]);
    setTableProgressByTable({});
    setHistory([]);
    setAnalyticsError('');
    setTablesLoading(false);
    setTablesError('');
    setHistoryError('');
  }, [isLoggedIn]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const handleLogin = async ({ email, password }) => {
    const result = await api.login({ email, password });
    localStorage.setItem('authToken', result.token);
    setAuthToken(result.token);
    setActiveTab('Dashboard');
  };

  const handleLogout = async () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem(ACTIVE_TAB_STORAGE_KEY);
    setAuthToken('');
    setAnalytics(null);
    setTables([]);
    setHistory([]);
    setActiveTab('Dashboard');
  };

  const handleNavigate = (tabKey) => {
    setActiveTab(tabKey);
  };

  const handleToggleTheme = () => {
    setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'));
  };

  const refreshProtectedData = async () => {
    if (!isLoggedIn) {
      return;
    }

    await loadProtectedData();
  };

  const handleStartTest = async (payload) => api.startTest(payload);

  const handleSaveDashboardNote = useCallback(async (content) => {
    setDashboardNoteSaving(true);
    setDashboardNoteError('');

    try {
      const response = await api.saveDashboardNote({ content });
      setDashboardNote(response?.note?.content || '');
      setDashboardNoteUpdatedAt(response?.note?.updatedAt || null);
      return response;
    } catch (error) {
      const message = error.message || 'Unable to save note';
      setDashboardNoteError(message);
      throw error;
    } finally {
      setDashboardNoteSaving(false);
    }
  }, []);

  const handleSubmitTest = async (payload) => {
    const result = await api.submitTest(payload);
    await refreshProtectedData();
    return result;
  };

  const handleUpdateQuestion = async (payload) => api.updateTestQuestion(payload);

  const title = useMemo(() => activeTab, [activeTab]);

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <header className="portal-topbar">
        <div className="portal-brand">
          <div className="portal-brand-badge" aria-hidden="true">
            <img src={geminiLogo} alt="" className="portal-brand-logo" />
          </div>
          <strong>PlaceTest Admin</strong>
        </div>

        <nav className="portal-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activeTab === item.key ? 'portal-nav-btn active' : 'portal-nav-btn'}
              onClick={() => handleNavigate(item.key)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="theme-toggle-btn"
          onClick={handleToggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to professional dark theme'}
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
              <path d="M12 2V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 19V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M2 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M19 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 12.79A9 9 0 1 1 11.21 3C11.14 3.32 11.1 3.66 11.1 4A8 8 0 0 0 20 12C20.34 12 20.68 11.96 21 11.89V12.79Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span>{theme === 'dark' ? 'Light' : 'Pro Dark'}</span>
        </button>

        <button type="button" className="logout-link" onClick={handleLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 17L15 12L10 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M21 4V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Logout</span>
        </button>
      </header>

      <main className="content-area">
        {activeTab === 'Dashboard' ? (
          <DashboardPage
            title={title}
            analytics={analytics}
            loading={analyticsLoading}
            error={analyticsError}
            noteContent={dashboardNote}
            noteUpdatedAt={dashboardNoteUpdatedAt}
            noteSaving={dashboardNoteSaving}
            noteError={dashboardNoteError}
            onSaveNote={handleSaveDashboardNote}
          />
        ) : null}

        {activeTab === 'Upload' ? <UploadPage onUploadComplete={refreshProtectedData} /> : null}

        {activeTab === 'Test' ? (
          viewingHistory ? (
            <HistoryPage
              history={history}
              historyLoading={historyLoading}
              historyError={historyError}
              onBack={() => setViewingHistory(false)}
            />
          ) : (
            <TestPage
              tables={tables}
              tableProgressByTable={tableProgressByTable}
              tablesLoading={tablesLoading}
              tablesError={tablesError}
              history={history}
              historyLoading={historyLoading}
              historyError={historyError}
              onStartTest={handleStartTest}
              onSubmitTest={handleSubmitTest}
              onUpdateQuestion={handleUpdateQuestion}
              onRefreshHistory={refreshProtectedData}
              onViewHistory={() => setViewingHistory(true)}
            />
          )
        ) : null}
      </main>
    </div>
  );
}

export default App;
