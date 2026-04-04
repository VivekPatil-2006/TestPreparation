import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const buildFallbackCalendarDays = () => {
  const today = new Date();
  const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - 364);

  const days = [];
  for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    days.push({
      date: cursor.toISOString().slice(0, 10),
      submissions: 0,
    });
  }

  return days;
};

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const getMonthLabel = (month) => MONTH_OPTIONS[month - 1]?.label || 'Month';

const getCalendarDateLabel = (dateValue) => {
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function DashboardPage({
  title,
  analytics,
  loading,
  error,
  noteContent = '',
  noteUpdatedAt = null,
  noteSaving = false,
  noteError = '',
  onSaveNote,
}) {
  const safeAnalytics = analytics || {
    totalTables: 0,
    totalRows: 0,
    questionTableCount: 0,
    questionRowCount: 0,
    testSessionCount: 0,
    avgScore: 0,
    avgDurationMinutes: 0,
    submissionCalendar: {
      days: [],
      totalSubmissions: 0,
      activeDays: 0,
      maxStreak: 0,
      currentStreak: 0,
      startDate: null,
      endDate: null,
    },
    tableDetails: [],
  };

  const formatLastUpdated = (value) => {
    if (!value) {
      return 'N/A';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'N/A';
    }

    return date.toLocaleString();
  };

  const averageRows = safeAnalytics.totalTables
    ? Math.round(safeAnalytics.totalRows / safeAnalytics.totalTables)
    : 0;

  const tableDetails = Array.isArray(safeAnalytics.tableDetails) ? safeAnalytics.tableDetails : [];
  const questionCount = safeAnalytics.questionRowCount || 0;
  const subjectsCount = safeAnalytics.questionTableCount || 0;
  const testSessions = safeAnalytics.testSessionCount || 0;
  const avgScore = safeAnalytics.avgScore || 0;
  const avgDurationMinutes = safeAnalytics.avgDurationMinutes || 0;

  const tableRows = loading
    ? Array.from({ length: 5 }, (_, index) => ({ tableName: `loading-${index}` }))
    : tableDetails;

  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [submissionMonthData, setSubmissionMonthData] = useState(() => ({
    year: currentYear,
    month: currentMonth,
    monthName: getMonthLabel(currentMonth),
    availableYears: [currentYear],
    days: [],
    totalSubmissions: 0,
    activeDays: 0,
    maxStreak: 0,
    currentStreak: 0,
  }));
  const [hoveredDay, setHoveredDay] = useState(null);

  const availableYears = useMemo(() => {
    const sourceYears = Array.isArray(submissionMonthData.availableYears)
      ? submissionMonthData.availableYears.filter((year) => Number.isInteger(year) && year <= currentYear)
      : [];

    if (!sourceYears.length) {
      return [currentYear];
    }

    const normalizedYears = new Set(sourceYears);
    normalizedYears.add(currentYear);

    return Array.from(normalizedYears).sort((left, right) => left - right);
  }, [currentYear, submissionMonthData.availableYears]);

  const earliestAvailableYear = availableYears[0] || currentYear;
  const canGoToPreviousMonth = selectedYear > earliestAvailableYear || (selectedYear === earliestAvailableYear && selectedMonth > 1);
  const canGoToNextMonth = selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth);

  const handleMonthChange = (nextMonth) => {
    if (selectedYear === currentYear && nextMonth > currentMonth) {
      return;
    }

    setSelectedMonth(nextMonth);
    setHoveredDay(null);
  };

  const handleYearChange = (nextYear) => {
    if (nextYear > currentYear) {
      return;
    }

    setSelectedYear(nextYear);
    setHoveredDay(null);

    if (nextYear === currentYear && selectedMonth > currentMonth) {
      setSelectedMonth(currentMonth);
    }
  };

  const handlePreviousMonth = () => {
    if (!canGoToPreviousMonth) {
      return;
    }

    if (selectedMonth === 1) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }

    setHoveredDay(null);
  };

  const handleNextMonth = () => {
    if (!canGoToNextMonth) {
      return;
    }

    if (selectedMonth === 12) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }

    setHoveredDay(null);
  };

  useEffect(() => {
    let isMounted = true;
    setSubmissionLoading(true);
    setSubmissionError('');

    void api.getSubmissionMonth({ month: selectedMonth, year: selectedYear })
      .then((response) => {
        if (!isMounted) {
          return;
        }

        const submissionMonth = response?.submissionMonth || {};
        setSubmissionMonthData((previous) => ({
          ...previous,
          ...submissionMonth,
        }));

        if (submissionMonth.year && submissionMonth.year !== selectedYear) {
          setSelectedYear(submissionMonth.year);
        }
        if (submissionMonth.month && submissionMonth.month !== selectedMonth) {
          setSelectedMonth(submissionMonth.month);
        }
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }
        setSubmissionError(err.message || 'Failed to load submission activity');
      })
      .finally(() => {
        if (isMounted) {
          setSubmissionLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (selectedYear > currentYear || (selectedYear === currentYear && selectedMonth > currentMonth)) {
      setSelectedYear(currentYear);
      setSelectedMonth(currentMonth);
    }
  }, [currentMonth, currentYear, selectedMonth, selectedYear]);

  const contributionCalendar = useMemo(() => {
    const sourceDays = Array.isArray(submissionMonthData.days) && submissionMonthData.days.length
      ? submissionMonthData.days
      : buildFallbackCalendarDays();

    return {
      year: submissionMonthData.year || selectedYear,
      month: submissionMonthData.month || selectedMonth,
      monthName: submissionMonthData.monthName || getMonthLabel(selectedMonth),
      availableYears,
      days: sourceDays,
      totalSubmissions: submissionMonthData.totalSubmissions || 0,
      activeDays: submissionMonthData.activeDays || 0,
      maxStreak: submissionMonthData.maxStreak || 0,
      currentStreak: submissionMonthData.currentStreak || 0,
    };
  }, [availableYears, selectedMonth, selectedYear, submissionMonthData]);

  const contributionLayout = useMemo(() => {
    const days = Array.isArray(contributionCalendar.days) ? contributionCalendar.days : [];

    if (!days.length) {
      return {
        cells: [],
      };
    }

    const firstDay = new Date(`${days[0].date}T00:00:00Z`);
    const mondayAlignedOffset = (firstDay.getUTCDay() + 6) % 7;
    const paddedDays = [
      ...Array.from({ length: mondayAlignedOffset }, () => null),
      ...days,
    ];

    const remainder = paddedDays.length % 7;
    const tailPadding = remainder === 0 ? 0 : 7 - remainder;
    for (let index = 0; index < tailPadding; index += 1) {
      paddedDays.push(null);
    }

    return {
      cells: paddedDays,
    };
  }, [contributionCalendar.days, contributionCalendar.year]);

  const getContributionLevel = (submissions) => {
    if (submissions <= 0) return 0;
    if (submissions <= 1) return 1;
    if (submissions <= 2) return 2;
    if (submissions <= 4) return 3;
    return 4;
  };

  const [noteDraft, setNoteDraft] = useState(noteContent || '');
  const [localStatus, setLocalStatus] = useState('Saved');

  useEffect(() => {
    setNoteDraft(noteContent || '');
  }, [noteContent]);

  useEffect(() => {
    if (!onSaveNote) {
      return undefined;
    }

    if (noteDraft === (noteContent || '')) {
      setLocalStatus('Saved');
      return undefined;
    }

    setLocalStatus('Typing...');
    const timerId = setTimeout(() => {
      setLocalStatus('Saving...');
      void onSaveNote(noteDraft)
        .then(() => setLocalStatus('Saved'))
        .catch(() => setLocalStatus('Save failed'));
    }, 650);

    return () => clearTimeout(timerId);
  }, [noteDraft, noteContent, onSaveNote]);

  const formatNoteUpdatedAt = (value) => {
    if (!value) {
      return 'Never';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Never';
    }

    return date.toLocaleString();
  };

  return (
    <section className="dashboard-page">
      <div className="dashboard-title-block">
        <h1>{title}</h1>
        <p>Overview of your placement test data</p>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {!loading && !analytics && !error ? <div className="panel-card">No analytics data found.</div> : null}

      <div className="dashboard-grid">
        <div className="metric-card metric-card-dashboard">
          <div className="metric-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="12" cy="5" rx="7" ry="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M5 5V12C5 13.66 8.13 15 12 15C15.87 15 19 13.66 19 12V5" stroke="currentColor" strokeWidth="2"/>
              <path d="M5 12V19C5 20.66 8.13 22 12 22C15.87 22 19 20.66 19 19V12" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <p>Total Tables</p>
          <strong>{loading ? <span className="dashboard-value-loading" /> : safeAnalytics.totalTables.toLocaleString()}</strong>
          <span>Public schema base tables</span>
        </div>

        <div className="metric-card metric-card-dashboard">
          <div className="metric-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="16" height="16" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 9H20" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 14H20" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <p>Total Rows</p>
          <strong>{loading ? <span className="dashboard-value-loading" /> : safeAnalytics.totalRows.toLocaleString()}</strong>
          <span>Estimated rows across all tables</span>
        </div>

        <div className="metric-card metric-card-dashboard">
          <div className="metric-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 3H14L18 7V21H7V3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M14 3V7H18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M10 12H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p>Questions</p>
          <strong>{loading ? <span className="dashboard-value-loading" /> : questionCount.toLocaleString()}</strong>
          <span>{loading ? 'Loading subjects...' : `across ${subjectsCount} subjects`}</span>
        </div>

        <div className="metric-card metric-card-dashboard">
          <div className="metric-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 11C8 8.79 9.79 7 12 7C14.21 7 16 8.79 16 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M4 20V18C4 15.79 5.79 14 8 14H16C18.21 14 20 15.79 20 18V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <p>Test Sessions</p>
          <strong>{loading ? <span className="dashboard-value-loading" /> : testSessions.toLocaleString()}</strong>
          <span>Completed and in-progress sessions</span>
        </div>

        <div className="metric-card metric-card-dashboard">
          <div className="metric-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 15L9 10L13 14L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 12V7H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p>Avg Score</p>
          <strong>{loading ? <span className="dashboard-value-loading" /> : `${avgScore}%`}</strong>
          <span>Average score from submitted sessions</span>
        </div>

        <div className="metric-card metric-card-dashboard">
          <div className="metric-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 7V12L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p>Avg Duration</p>
          <strong>{loading ? <span className="dashboard-value-loading" /> : `${avgDurationMinutes} min`}</strong>
          <span>Average configured test duration</span>
        </div>
      </div>

      <div className="panel-card dashboard-activity-card">
        <div className="panel-header dashboard-activity-header">
          <div>
            <h2>Submissions in {contributionCalendar.monthName} {contributionCalendar.year}</h2>
            <p className="dashboard-activity-subtitle">LeetCode-style view of your completed test sessions</p>
          </div>
          <div className="dashboard-activity-stats">
            <span>Total submissions: {loading || submissionLoading ? '...' : contributionCalendar.totalSubmissions || 0}</span>
            <span>Active days: {loading || submissionLoading ? '...' : contributionCalendar.activeDays || 0}</span>
            <span>Max streak: {loading || submissionLoading ? '...' : contributionCalendar.maxStreak || 0}</span>
            <span>Current streak: {loading || submissionLoading ? '...' : contributionCalendar.currentStreak || 0}</span>
          </div>
        </div>

        <div className="dashboard-activity-nav">
          <div className="dashboard-activity-nav-buttons">
            <button type="button" className="dashboard-activity-nav-button" onClick={handlePreviousMonth} disabled={!canGoToPreviousMonth}>
              Previous
            </button>
            <button type="button" className="dashboard-activity-nav-button" onClick={handleNextMonth} disabled={!canGoToNextMonth}>
              Next
            </button>
          </div>

          <div className="dashboard-activity-filters">
            <label>
              <span>Month</span>
              <select value={selectedMonth} onChange={(event) => handleMonthChange(Number(event.target.value))}>
                {MONTH_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={selectedYear === currentYear && option.value > currentMonth}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Year</span>
              <select value={selectedYear} onChange={(event) => handleYearChange(Number(event.target.value))}>
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="dashboard-activity-tooltip" aria-live="polite">
          {hoveredDay ? (
            <>
              <strong>{getCalendarDateLabel(hoveredDay.date)}</strong>
              <span>{hoveredDay.submissions} submission{hoveredDay.submissions === 1 ? '' : 's'}</span>
            </>
          ) : (
            <>
              <strong>Hover a day</strong>
              <span>See the exact date and submission count</span>
            </>
          )}
        </div>

        <div className="dashboard-activity-toolbar">
          <span className="dashboard-activity-legend-label">Less</span>
          <div className="dashboard-activity-legend">
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} className={`dashboard-activity-swatch level-${level}`} aria-hidden="true" />
            ))}
          </div>
          <span className="dashboard-activity-legend-label">More</span>
        </div>

        <div className="dashboard-activity-scroll">
          <div className="dashboard-activity-scroll-inner">
            {loading || submissionLoading ? (
              <div className="dashboard-activity-loading-shell" role="status" aria-live="polite" aria-label="Loading submission activity">
                <span className="dashboard-activity-spinner" aria-hidden="true" />
                <span>Loading submission activity...</span>
              </div>
            ) : (
              <div className="dashboard-activity-heatmap" aria-label="Contribution heatmap">
                <div className="dashboard-activity-week-labels" aria-hidden="true">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>

                <div className="dashboard-activity-grid-wrap">
                  {contributionLayout.cells.map((day, cellIndex) => {
                    if (!day) {
                      return <span key={`empty-${cellIndex}`} className="dashboard-activity-cell empty" aria-hidden="true" />;
                    }

                    const level = getContributionLevel(day.submissions);
                    return (
                      <span
                        key={day.date}
                        className={`dashboard-activity-cell level-${level}`}
                        title={`${day.date}: ${day.submissions} submission${day.submissions === 1 ? '' : 's'}`}
                        aria-label={`${day.date}: ${day.submissions} submission${day.submissions === 1 ? '' : 's'}`}
                        tabIndex={0}
                        onMouseEnter={() => setHoveredDay(day)}
                        onFocus={() => setHoveredDay(day)}
                        onMouseLeave={() => setHoveredDay(null)}
                        onBlur={() => setHoveredDay(null)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        {submissionError ? <div className="error-banner">{submissionError}</div> : null}
      </div>

      <div className="panel-card dashboard-note-card">
        <div className="panel-header">
          <h2>Notepad</h2>
          <span>
            {noteSaving ? 'Saving' : localStatus} • Updated {formatNoteUpdatedAt(noteUpdatedAt)}
          </span>
        </div>
        <textarea
          className="dashboard-note-input"
          rows="8"
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          placeholder="Add quick reminders, follow-ups, or anything you want to keep on the dashboard..."
        />
        <div className="dashboard-note-footer">
          <span className="dashboard-note-hint">Autosaves while you type.</span>
          <span className="dashboard-note-count">{noteDraft.length} characters</span>
        </div>
        {noteError ? <div className="error-banner">{noteError}</div> : null}
      </div>

      <div className="panel-card table-overview dashboard-table-card">
        <div className="panel-header dashboard-table-head">
          <h2>Table Details</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Table Name</th>
              <th>Rows</th>
              <th>Last Updated</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.length ? tableRows.map((table) => (
              <tr key={table.tableName} className={loading ? 'dashboard-row-placeholder' : ''}>
                <td>{loading ? <span className="dashboard-cell-loading" /> : table.tableName}</td>
                <td>{loading ? <span className="dashboard-cell-loading" /> : table.rowCount.toLocaleString()}</td>
                <td>{loading ? <span className="dashboard-cell-loading" /> : formatLastUpdated(table.lastActivityAt)}</td>
                <td>
                  {loading ? <span className="dashboard-status-loading" /> : <span className="status-pill">active</span>}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="dashboard-empty-row">No table details available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {averageRows ? <p className="dashboard-helper-note">Average rows per table: {averageRows.toLocaleString()}</p> : null}
    </section>
  );
}

export default DashboardPage;
