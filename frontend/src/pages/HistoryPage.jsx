import { useState, useMemo } from 'react';

const formatDateTime = (value) => {
  if (!value) {
    return 'recently';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  return date.toLocaleString();
};

function HistoryPage({ history = [], historyLoading = false, historyError = '', onBack }) {
  const [filterTable, setFilterTable] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('date'); // date, score, table

  // Get unique tables for filter
  const uniqueTables = useMemo(() => {
    const tables = new Set(history.map((item) => item.tableName));
    return Array.from(tables).sort();
  }, [history]);

  // Filter and sort history
  const filteredHistory = useMemo(() => {
    let filtered = history;

    if (filterTable) {
      filtered = filtered.filter((item) => item.tableName === filterTable);
    }

    if (filterStatus) {
      filtered = filtered.filter((item) => item.status === filterStatus);
    }

    // Sort
    const sorted = [...filtered];
    if (sortBy === 'date') {
      sorted.sort((a, b) => new Date(b.completedAt || b.startedAt) - new Date(a.completedAt || a.startedAt));
    } else if (sortBy === 'score') {
      sorted.sort((a, b) => (b.percentageScore || 0) - (a.percentageScore || 0));
    } else if (sortBy === 'table') {
      sorted.sort((a, b) => a.tableName.localeCompare(b.tableName));
    }

    return sorted;
  }, [history, filterTable, filterStatus, sortBy]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (filteredHistory.length === 0) {
      return { totalTests: 0, avgScore: 0, bestScore: 0, totalTime: 0 };
    }

    const completedTests = filteredHistory.filter((item) => item.status === 'completed');
    const avgScore = completedTests.length > 0 ? Math.round((completedTests.reduce((sum, item) => sum + (item.percentageScore || 0), 0) / completedTests.length) * 100) / 100 : 0;
    const bestScore = completedTests.length > 0 ? Math.max(...completedTests.map((item) => item.percentageScore || 0)) : 0;
    const totalTime = filteredHistory.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);

    return {
      totalTests: filteredHistory.length,
      avgScore,
      bestScore,
      totalTime,
    };
  }, [filteredHistory]);

  if (historyLoading) {
    return (
      <section className="history-page">
        <div className="history-header">
          <button className="history-back-button" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.41l5.29-5.29c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-7 7c-.39.39-.39 1.02 0 1.41l7 7c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.41 13H20c.55 0 1-.45 1-1s-.45-1-1-1z" />
            </svg>
            <span>Back to Test</span>
          </button>
          <h1>Test History</h1>
          <p>View and analyze your test sessions</p>
        </div>

        <div className="history-loading">Loading history...</div>
      </section>
    );
  }

  return (
    <section className="history-page">
      <div className="history-header">
        <button className="history-back-button" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.41l5.29-5.29c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-7 7c-.39.39-.39 1.02 0 1.41l7 7c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.41 13H20c.55 0 1-.45 1-1s-.45-1-1-1z" />
          </svg>
          <span>Back to Test</span>
        </button>
        <div>
          <h1>Test History</h1>
          <p>View and analyze your test sessions</p>
        </div>
      </div>

      {historyError && <div className="error-banner">{historyError}</div>}

      {/* Statistics Cards */}
      {filteredHistory.length > 0 && (
        <div className="history-stats-grid">
          <div className="history-stat-card">
            <div className="history-stat-value">{stats.totalTests}</div>
            <div className="history-stat-label">Total Tests</div>
          </div>
          <div className="history-stat-card">
            <div className="history-stat-value">{stats.avgScore}%</div>
            <div className="history-stat-label">Average Score</div>
          </div>
          <div className="history-stat-card">
            <div className="history-stat-value">{stats.bestScore}%</div>
            <div className="history-stat-label">Best Score</div>
          </div>
          <div className="history-stat-card">
            <div className="history-stat-value">{stats.totalTime}m</div>
            <div className="history-stat-label">Total Time</div>
          </div>
        </div>
      )}

      {/* Filters and Sorting */}
      <div className="history-controls">
        <div className="history-filters">
          <div className="history-filter-group">
            <label>Filter by Table</label>
            <select value={filterTable} onChange={(e) => setFilterTable(e.target.value)} className="history-select">
              <option value="">All Tables</option>
              {uniqueTables.map((table) => (
                <option key={table} value={table}>
                  {table}
                </option>
              ))}
            </select>
          </div>

          <div className="history-filter-group">
            <label>Filter by Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="history-select">
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="history-filter-group">
            <label>Sort by</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="history-select">
              <option value="date">Latest First</option>
              <option value="score">Highest Score</option>
              <option value="table">Table Name</option>
            </select>
          </div>
        </div>

        <button
          className="history-clear-filters"
          onClick={() => {
            setFilterTable('');
            setFilterStatus('');
            setSortBy('date');
          }}
          disabled={!filterTable && !filterStatus && sortBy === 'date'}
        >
          Clear Filters
        </button>
      </div>

      {/* History List */}
      <div className="history-list-container">
        {filteredHistory.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon">📋</div>
            <h3>No test sessions found</h3>
            <p>{history.length === 0 ? 'Start a test to see your history here.' : 'Try adjusting your filters.'}</p>
          </div>
        ) : (
          <div className="history-list">
            {filteredHistory.map((item) => (
              <article key={item.sessionId} className="history-item">
                <div className="history-item-main">
                  <div className="history-item-title">
                    <h3>{item.tableName}</h3>
                    <span className={`history-item-status ${item.status === 'completed' ? 'status-completed' : 'status-pending'}`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="history-item-details">
                    <div className="detail">
                      <span className="detail-label">Rows:</span>
                      <span className="detail-value">
                        {item.startRow} - {item.endRow}
                      </span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Questions:</span>
                      <span className="detail-value">{item.questionCount}</span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Duration:</span>
                      <span className="detail-value">{item.durationMinutes} min</span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Date:</span>
                      <span className="detail-value">{formatDateTime(item.completedAt || item.startedAt)}</span>
                    </div>
                  </div>
                </div>

                {item.status === 'completed' && item.obtainedMarks != null && (
                  <div className="history-item-score">
                    <div className="score-value">
                      {item.obtainedMarks}/{item.totalMarks}
                    </div>
                    <div className="score-percentage">
                      {item.percentageScore}%
                    </div>
                  </div>
                )}

                {item.status === 'pending' && (
                  <div className="history-item-pending">
                    <span>Pending</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {filteredHistory.length > 0 && (
          <div className="history-count">
            Showing {filteredHistory.length} of {history.length} sessions
          </div>
        )}
      </div>
    </section>
  );
}

export default HistoryPage;
