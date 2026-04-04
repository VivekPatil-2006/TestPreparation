import { useCallback, useEffect, useMemo, useState } from 'react';

const QUESTION_COUNT = 20;

const formatSeconds = (secondsLeft) => {
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const getQuestionText = (question) => {
  if (!question) {
    return '';
  }

  return String(question.questionText || question.question || question.prompt || question.title || '').trim();
};

const getQuestionOptions = (question) => {
  if (!question) {
    return [];
  }

  if (Array.isArray(question.options)) {
    return question.options.map((option) => String(option).trim()).filter(Boolean);
  }

  const fallbackKeys = ['option1', 'option2', 'option3', 'option4', 'option_a', 'option_b', 'option_c', 'option_d'];
  return fallbackKeys
    .map((key) => question[key])
    .map((option) => (option == null ? '' : String(option).trim()))
    .filter(Boolean);
};

const getQuestionKey = (question, index) => String(question?.questionKey || question?.rowId || question?.id || question?.rowNumber || index);

const normalizeSelectedAnswer = (value) => String(value == null ? '' : value).trim().toLowerCase();

const detectAndFormatProgram = (text) => {
  if (!text) return { hasProgram: false, beforeProgram: '', program: '', afterProgram: '' };
  
  // Detect if text contains program code keywords
  const programKeywords = ['public class', 'public void', 'private', 'static', 'System.out', 'public static void main', 'int x', '#include', '{', '}'];
  const hasProgram = programKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));
  
  if (!hasProgram) {
    return { hasProgram: false, beforeProgram: text, program: '', afterProgram: '' };
  }
  
  // Try to extract program block (from first { to last })
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  
  if (firstBrace > -1 && lastBrace > firstBrace) {
    // Find the start of the line containing first {
    let programStart = firstBrace;
    while (programStart > 0 && text[programStart - 1] !== '\n') {
      programStart--;
    }
    if (programStart > 0 && text[programStart - 1] === '\n') {
      programStart--;
    }
    
    const beforeProgram = text.substring(0, programStart).trim();
    let program = text.substring(programStart, lastBrace + 1).trim();
    const afterProgram = text.substring(lastBrace + 1).trim();
    
    // Format program: convert escaped sequences and add intelligent line breaks
    program = program
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ')
      .replace(/\\"/g, '"') // Handle escaped quotes
      .replace(/\s+/g, ' '); // Normalize whitespace first
    
    // Add line breaks for better readability
    program = program
      // Add newline before keywords at statement start
      .replace(/(\s)(public|private|protected|static|void|int|char|float|double|boolean|class|if|else|for|while|return|import|include)\s/g, '\n$2 ')
      // Add newline after opening braces
      .replace(/\{\s*/g, '{\n  ')
      // Add newline before closing braces
      .replace(/\s*\}/g, '\n}')
      // Add newline after semicolons (statement end)
      .replace(/;\s*/g, ';\n  ')
      // Clean up multiple newlines
      .replace(/\n\s*\n/g, '\n')
      // Remove leading/trailing whitespace from lines
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
    
    return { hasProgram: true, beforeProgram, program, afterProgram };
  }
  
  return { hasProgram: false, beforeProgram: text, program: '', afterProgram: '' };
};

function TestPage({
  tables,
  tableProgressByTable = {},
  tablesLoading = false,
  tablesError = '',
  history = [],
  historyLoading = false,
  historyError = '',
  onStartTest,
  onSubmitTest,
  onSessionStateChange,
  onRefreshHistory,
  onViewHistory,
}) {
  const [selectedTables, setSelectedTables] = useState([]);
  const [tableSearch, setTableSearch] = useState('');
  const [defaultStartRow, setDefaultStartRow] = useState(1);
  const [startRowsByTable, setStartRowsByTable] = useState({});
  const [timerMode, setTimerMode] = useState('per_question');
  const [customMinutes, setCustomMinutes] = useState(30);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [session, setSession] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [finalResult, setFinalResult] = useState(null);
  const [tabBlocked, setTabBlocked] = useState(false);
  const [fullscreenLost, setFullscreenLost] = useState(false);

  const visibleTables = useMemo(
    () => (Array.isArray(tables) ? tables.filter((table) => String(table).toLowerCase() !== 'test_sessions') : []),
    [tables]
  );

  const filteredTables = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    if (!query) {
      return visibleTables;
    }

    return visibleTables.filter((table) => String(table).toLowerCase().includes(query));
  }, [tableSearch, visibleTables]);

  const effectiveDurationMinutes = useMemo(() => {
    if (timerMode === 'custom') {
      return Math.max(Number(customMinutes) || 0, 1);
    }

    return Math.max(Number(QUESTION_COUNT) || 30, 1);
  }, [timerMode, customMinutes]);

  const defaultStartRowSafe = Math.max(Number(defaultStartRow) || 1, 1);

  useEffect(() => {
    setSelectedTables((previous) => previous.filter((table) => visibleTables.includes(table)));
  }, [visibleTables]);

  useEffect(() => {
    setStartRowsByTable((previous) => {
      const next = {};
      selectedTables.forEach((table) => {
        const lastGiven = Math.max(Number(tableProgressByTable?.[table]) || 0, 0);
        const suggestedStart = Math.max(lastGiven + 1, 1);
        const rawValue = previous[table];
        const parsed = Math.max(Number(rawValue) || suggestedStart, 1);
        next[table] = parsed;
      });
      return next;
    });
  }, [selectedTables, tableProgressByTable]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    if (secondsLeft <= 0) {
      return undefined;
    }

    const timerId = setInterval(() => {
      setSecondsLeft((previous) => Math.max(previous - 1, 0));
    }, 1000);

    return () => clearInterval(timerId);
  }, [session, secondsLeft]);

  useEffect(() => {
    if (!session) {
      setTabBlocked(false);
      setFullscreenLost(false);
      onSessionStateChange?.(false);
      return undefined;
    }

    const handleVisibilityChange = () => {
      setTabBlocked(document.hidden);
    };

    const handleFullscreenChange = () => {
      setFullscreenLost(!document.fullscreenElement);
    };

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    handleVisibilityChange();
    handleFullscreenChange();
    onSessionStateChange?.(true);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [session, onSessionStateChange]);

  const requestFullscreen = async () => {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    }
  };

  const validateSetup = () => {
    if (!selectedTables.length) {
      return 'Select at least one table to start test.';
    }

    if (!Number.isFinite(Number(defaultStartRow)) || Number(defaultStartRow) < 1) {
      return 'Default start row must be at least 1.';
    }

    const invalidTable = selectedTables.find((table) => {
      const value = startRowsByTable[table];
      return !Number.isFinite(Number(value)) || Number(value) < 1;
    });

    if (invalidTable) {
      return `Start row for ${invalidTable} must be at least 1.`;
    }

    if (timerMode === 'custom' && (!Number.isFinite(Number(customMinutes)) || Number(customMinutes) < 1)) {
      return 'Defined timer must be at least 1 minute.';
    }

    return '';
  };

  const handleOpenConfirm = () => {
    const validationError = validateSetup();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setShowConfirmDialog(true);
  };

  const startTest = async () => {
    setShowConfirmDialog(false);
    setError('');
    setLoading(true);

    try {
      const response = await onStartTest({
        tableName: selectedTables[0],
        tableNames: selectedTables,
        startRow: Number(defaultStartRowSafe),
        startRowsByTable: Object.fromEntries(
          selectedTables.map((table) => [table, Math.max(Number(startRowsByTable[table]) || defaultStartRowSafe, 1)])
        ),
        questionCount: QUESTION_COUNT,
        timerMode,
        customMinutes: timerMode === 'custom' ? Number(customMinutes) : undefined,
      });

      setSession(response);
      setCurrentIndex(0);
      setAnswers({});
      setFinalResult(null);
      setSecondsLeft((response.durationMinutes || effectiveDurationMinutes) * 60);
      setTabBlocked(false);
      setFullscreenLost(false);

      await requestFullscreen();
    } catch (err) {
      setError(err.message || 'Unable to start test');
    } finally {
      setLoading(false);
    }
  };

  const submitSession = useCallback(async () => {
    if (!session || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const result = await onSubmitTest({
        sessionId: session.sessionId,
        answers,
      });

      setFinalResult(result);
      setSession(null);
      setCurrentIndex(0);
      setAnswers({});
      setSecondsLeft(0);
      setTabBlocked(false);
      setFullscreenLost(false);
      onSessionStateChange?.(false);

      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => undefined);
      }

      if (onRefreshHistory) {
        await onRefreshHistory();
      }
    } catch (err) {
      setError(err.message || 'Unable to finish test');
    } finally {
      setSubmitting(false);
    }
  }, [answers, onRefreshHistory, onSessionStateChange, onSubmitTest, session, submitting]);

  useEffect(() => {
    if (session && secondsLeft === 0 && !submitting) {
      void submitSession();
    }
  }, [secondsLeft, session, submitting, submitSession]);

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false);
  };

  const handleToggleSelectedTable = (tableName) => {
    const suggestedStart = Math.max((Number(tableProgressByTable?.[tableName]) || 0) + 1, 1);

    setSelectedTables((previous) => {
      if (previous.includes(tableName)) {
        return previous.filter((item) => item !== tableName);
      }

      return [...previous, tableName];
    });

    setStartRowsByTable((previous) => {
      if (selectedTables.includes(tableName)) {
        const next = { ...previous };
        delete next[tableName];
        return next;
      }

      return {
        ...previous,
        [tableName]: suggestedStart,
      };
    });
  };

  const handleRemoveSelectedTable = (tableName) => {
    setSelectedTables((previous) => previous.filter((item) => item !== tableName));
  };

  const handleTableStartRowChange = (tableName, value) => {
    setStartRowsByTable((previous) => ({
      ...previous,
      [tableName]: value,
    }));
  };

  const getLastGivenQuestion = (tableName) => Math.max(Number(tableProgressByTable?.[tableName]) || 0, 0);

  const getSuggestedStartRow = (tableName) => Math.max(getLastGivenQuestion(tableName) + 1, 1);

  const handleClearSelectedTables = () => {
    setSelectedTables([]);
    setStartRowsByTable({});
  };

  const allTablesSelected = visibleTables.length > 0 && selectedTables.length === visibleTables.length;

  const handleToggleSelectAllTables = () => {
    if (allTablesSelected) {
      setSelectedTables([]);
      setStartRowsByTable({});
      return;
    }

    setSelectedTables([...visibleTables]);
    setStartRowsByTable(
      Object.fromEntries(
        visibleTables.map((table) => {
          const suggestedStart = Math.max((Number(tableProgressByTable?.[table]) || 0) + 1, 1);
          return [table, suggestedStart];
        })
      )
    );
  };

  const handleReturnToSetup = () => {
    setFinalResult(null);
    setError('');
    setTabBlocked(false);
    setFullscreenLost(false);
  };

  const activeQuestion = session?.questions?.[currentIndex] || null;
  const activeQuestionText = getQuestionText(activeQuestion);
  const activeOptions = getQuestionOptions(activeQuestion);
  const activeQuestionKey = getQuestionKey(activeQuestion, currentIndex);
  const selectedAnswer = answers[activeQuestionKey] || '';

  if (finalResult) {
    return (
      <section className="test-result-page">
        <div className="test-setup-title-block">
          <h1>Test Completed</h1>
          <p>Your marks and submission summary are saved in history.</p>
        </div>

        <div className="test-result-grid">
          <div className="test-result-card test-result-score-card">
            <div className="test-result-score">
              <strong>{finalResult.obtainedMarks}</strong>
              <span>/{finalResult.totalMarks}</span>
            </div>
            <p>Marks obtained</p>
            <div className="test-result-percentage">{finalResult.percentageScore}%</div>
          </div>

          <div className="test-result-card">
            <h3>Session Summary</h3>
            <div className="test-result-summary-grid">
              <div>
                <span>Table</span>
                <strong>{finalResult.tableName}</strong>
              </div>
              <div>
                <span>Rows</span>
                <strong>
                  {finalResult.startRow} to {finalResult.endRow}
                </strong>
              </div>
              <div>
                <span>Questions</span>
                <strong>{finalResult.questionCount}</strong>
              </div>
              <div>
                <span>Timer</span>
                <strong>{finalResult.durationMinutes} min</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <h2>Answer Review</h2>
            <span>{finalResult.detailedResults?.length || 0} checked</span>
          </div>
          <div className="test-review-list">
            {(finalResult.detailedResults || []).map((item) => {
              const { hasProgram, beforeProgram, program, afterProgram } = detectAndFormatProgram(item.questionText || '');
              const correctAnswerSnippet = String(item.correctAnswer || '').substring(0, 50);
              const selectedAnswerSnippet = String(item.selectedAnswer || '').substring(0, 50);
              
              return (
                <div key={item.questionKey || item.rowId} className={item.isCorrect ? 'review-row review-row-correct' : 'review-row review-row-wrong'}>
                  <div className="review-row-content">
                    <div className="review-row-header">
                      <strong>Row {item.rowNumber}</strong>
                      <span className={item.isCorrect ? 'review-badge-correct' : 'review-badge-wrong'}>
                        {item.isCorrect ? '✓ Correct' : '✗ Wrong'}
                      </span>
                    </div>
                    
                    <div className="review-question-section">
                      <p className="review-section-label">Question:</p>
                      {beforeProgram && <p className="review-text">{beforeProgram}</p>}
                      {hasProgram && program && (
                        <pre className="program-block review-program">
                          <code>{program}</code>
                        </pre>
                      )}
                      {afterProgram && <p className="review-text">{afterProgram}</p>}
                    </div>
                    
                    <div className="review-answers-section">
                      <div className="review-answer-item">
                        <span className="review-label">Your Answer:</span>
                        <span className="review-value">{selectedAnswerSnippet || '(Not answered)'}</span>
                      </div>
                      <div className="review-answer-item">
                        <span className="review-label">Correct Answer:</span>
                        <span className="review-value">{correctAnswerSnippet}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button type="button" className="test-setup-button test-result-button" onClick={handleReturnToSetup}>
          Start New Test
        </button>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="test-setup-page">
        <div className="test-setup-title-block">
          <h1>Start Test</h1>
          <p>Choose one or more tables, select the first row, and launch a locked 20-question session.</p>
        </div>

        <div className="test-setup-layout">
          <div className="test-setup-card">
            <div className="test-setup-form">
              <div className="test-setup-overview-cards">
                <div className="test-overview-card">
                  <span>Selected Files</span>
                  <strong>{selectedTables.length}</strong>
                </div>
                <div className="test-overview-card">
                  <span>Questions</span>
                  <strong>{QUESTION_COUNT}</strong>
                </div>
                <div className="test-overview-card">
                  <span>Timer</span>
                  <strong>{timerMode === 'custom' ? `${customMinutes || 0} min` : `${QUESTION_COUNT} min`}</strong>
                </div>
                <div className="test-overview-card">
                  <span>Mode</span>
                  <strong>Locked</strong>
                </div>
              </div>

              <div className="test-setup-grid">
                <div className="test-setup-panel">
                  <div className="test-setup-panel-head">
                    <h3>Select Question Files</h3>
                    <p>Choose one or more tables and set per-file start row.</p>
                  </div>

                  <label htmlFor="table-search" className="test-setup-label">Search Table</label>
                  <input
                    id="table-search"
                    type="text"
                    value={tableSearch}
                    onChange={(event) => setTableSearch(event.target.value)}
                    placeholder="Search by table name"
                  />

                  {tablesLoading ? (
                    <div className="table-loading-container" role="status" aria-live="polite">
                      <div className="table-loading-head">
                        <span>Loading table list...</span>
                        <span>Please wait</span>
                      </div>
                      <div className="table-loading-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuetext="Loading tables" aria-busy="true">
                        <div className="table-loading-progress-fill" />
                      </div>
                    </div>
                  ) : null}

                  {!tablesLoading && visibleTables.length ? (
                    <div className="table-checkbox-panel" id="table-select" role="group" aria-label="Select question tables">
                      <label className="table-checkbox-item table-checkbox-select-all">
                        <input
                          type="checkbox"
                          checked={allTablesSelected}
                          onChange={handleToggleSelectAllTables}
                        />
                        <span>Select All Tables</span>
                      </label>

                      <div className="table-checkbox-list">
                        {filteredTables.map((table) => (
                          <label key={table} className="table-checkbox-item">
                            <input
                              type="checkbox"
                              checked={selectedTables.includes(table)}
                              onChange={() => handleToggleSelectedTable(table)}
                            />
                            <span>
                              {table}
                              <small className="table-progress-note">Last given: {getLastGivenQuestion(table)}</small>
                            </span>
                          </label>
                        ))}
                        {!filteredTables.length ? <p className="test-setup-note">No matching table found for this search.</p> : null}
                      </div>
                    </div>
                  ) : null}

                  {!tablesLoading && !visibleTables.length ? <p className="test-setup-note">No tables found.</p> : null}
                  {tablesError ? <div className="error-banner">{tablesError}</div> : null}

                  {selectedTables.length ? (
                    <div className="selected-tables-panel">
                      <div className="selected-tables-head">
                        <strong>Selected Files ({selectedTables.length})</strong>
                        <button type="button" className="selected-tables-clear" onClick={handleClearSelectedTables}>
                          Clear all
                        </button>
                      </div>
                      <div className="selected-tables-list">
                        {selectedTables.map((table) => (
                          <span key={table} className="selected-table-chip">
                            <span>{table}</span>
                            <button
                              type="button"
                              className="selected-table-remove"
                              onClick={() => handleRemoveSelectedTable(table)}
                              aria-label={`Remove ${table}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="table-start-grid">
                        {selectedTables.map((table) => (
                          <label key={`${table}-start-row`} className="table-start-item">
                            <span>{table} start row</span>
                            <input
                              type="number"
                              min="1"
                              value={startRowsByTable[table] ?? getSuggestedStartRow(table)}
                              onChange={(event) => handleTableStartRowChange(table, event.target.value)}
                            />
                            <small className="table-start-meta">Last given: {getLastGivenQuestion(table)} | Next suggested: {getSuggestedStartRow(table)}</small>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <p className="test-setup-note">Use checkboxes to choose one or more tables.</p>
                </div>

                <div className="test-setup-panel">
                  <div className="test-setup-panel-head">
                    <h3>Session Configuration</h3>
                    <p>Tune timer and defaults before launching the locked test.</p>
                  </div>

                  <label htmlFor="start-row" className="test-setup-label">Default Start Row (for new selections)</label>
                  <input
                    id="start-row"
                    type="number"
                    min="1"
                    value={defaultStartRow}
                    onChange={(event) => setDefaultStartRow(event.target.value)}
                  />

                  <label htmlFor="timer-mode" className="test-setup-label">Defined Timer Option</label>
                  <select
                    id="timer-mode"
                    className="test-setup-select"
                    value={timerMode}
                    onChange={(event) => setTimerMode(event.target.value)}
                  >
                    <option value="per_question">Default: 1 minute per question</option>
                    <option value="custom">Defined total timer</option>
                  </select>

                  {timerMode === 'custom' ? (
                    <>
                      <label htmlFor="custom-minutes" className="test-setup-label">Defined Total Minutes</label>
                      <input
                        id="custom-minutes"
                        type="number"
                        min="1"
                        value={customMinutes}
                        onChange={(event) => setCustomMinutes(event.target.value)}
                      />
                    </>
                  ) : null}

                  <div className="test-setup-details">
                    <p className="test-detail-row">
                      <span className="test-detail-label">Questions:</span>
                      <span className="test-detail-value">{QUESTION_COUNT}</span>
                    </p>
                    <p className="test-detail-row">
                      <span className="test-detail-label">Range:</span>
                      <span className="test-detail-value">Combined from per-table start rows</span>
                    </p>
                    <p className="test-detail-row">
                      <span className="test-detail-label">Timer:</span>
                      <span className="test-detail-value">{timerMode === 'custom' ? `${customMinutes || 0} minute total` : '1 minute per question'}</span>
                    </p>
                    <p className="test-detail-row">
                      <span className="test-detail-label">Mode:</span>
                      <span className="test-detail-value">Full-screen lock enabled</span>
                    </p>
                  </div>

                  <div className="test-setup-actions">
                    <button
                      type="button"
                      className="test-setup-button"
                      onClick={handleOpenConfirm}
                      disabled={loading || tablesLoading || !visibleTables.length}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 5V19L19 12L8 5Z" />
                      </svg>
                      <span>{loading ? 'Preparing Test...' : 'Start Test'}</span>
                    </button>

                    <button type="button" className="test-setup-button test-history-button" onClick={() => onViewHistory?.()} title="View all test sessions with filtering">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-13.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm0 5c2.33 0 4.31 1.46 5.11 3.5H6.89c.8-2.04 2.78-3.5 5.11-3.5z" />
                      </svg>
                      <span>View History</span>
                    </button>
                  </div>

                  <p className="test-setup-note">Only questions with 4 options and a valid answer are included.</p>
                </div>
              </div>

              {error ? <div className="error-banner">{error}</div> : null}
            </div>
          </div>
        </div>

        {showConfirmDialog && (
          <div className="modal-overlay">
            <div className="modal-content confirmation-modal">
              <div className="modal-header">
                <h2>Confirm Test Start</h2>
                <button className="modal-close" onClick={handleCancelConfirm} aria-label="Close">✕</button>
              </div>

              <div className="modal-body">
                <div className="file-info-card">
                  <div className="file-info-icon">📝</div>
                  <div className="file-info-details">
                    <p className="file-name">{selectedTables.join(', ')}</p>
                    <p className="file-meta">Per-table start rows will be combined into one final test.</p>
                  </div>
                </div>

                <div className="confirmation-message">
                  <h3>Start locked fullscreen test?</h3>
                  <p>
                    The test will open in fullscreen, lock navigation, and save the session history after submission.
                  </p>
                </div>

                <div className="upload-details-box">
                  <p className="detail-item"><strong>Questions:</strong> {QUESTION_COUNT} (combined from selected tables)</p>
                  <p className="detail-item">
                    <strong>Timer:</strong>{' '}
                    {timerMode === 'custom' ? `${customMinutes} minute total` : '1 minute per question'}
                  </p>
                  <p className="detail-item"><strong>Lock:</strong> Tab navigation disabled during session</p>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-secondary" onClick={handleCancelConfirm} disabled={loading}>Cancel</button>
                <button className="btn-primary" onClick={startTest} disabled={loading}>
                  {loading ? 'Starting...' : 'Confirm Start'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  const lockMessage = tabBlocked
    ? 'You switched tabs. Return here to continue.'
    : fullscreenLost
      ? 'Fullscreen mode is required. Return to fullscreen to continue.'
      : '';

  return (
    <section className="test-room-shell">
      {lockMessage ? (
        <div className="test-lock-overlay">
          <div className="test-lock-card">
            <h2>Test Locked</h2>
            <p>{lockMessage}</p>
            <button type="button" className="test-setup-button" onClick={requestFullscreen}>
              Return to Test
            </button>
          </div>
        </div>
      ) : null}

      <div className="test-room">
        <div className="test-header">
          <div>
            <h2>{session.tableName} Test</h2>
            <p className="subtle-copy">Rows {session.startRow} to {Math.max(session.endRow - 1, session.startRow)} | {session.questionCount} questions</p>
          </div>
          <div className="timer-chip">Time Left: {formatSeconds(secondsLeft)}</div>
        </div>

        <p className="question-count">
          Question {currentIndex + 1} of {session.questionCount}
        </p>

        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${((currentIndex + 1) / session.questionCount) * 100}%` }} />
        </div>

        <div className="question-box">
          {(() => {
            const { hasProgram, beforeProgram, program, afterProgram } = detectAndFormatProgram(activeQuestionText);
            return (
              <>
                {beforeProgram && <p>{beforeProgram}</p>}
                {hasProgram && program && (
                  <pre className="program-block">
                    <code>{program}</code>
                  </pre>
                )}
                {afterProgram && <p>{afterProgram}</p>}
              </>
            );
          })()}
          <p className="test-question-row">Database row: {activeQuestion?.rowNumber}</p>

          {activeOptions.length === 4 ? (
            <div className="option-list">
              {activeOptions.map((option) => (
                <label key={option} className="option-item">
                  <input
                    type="radio"
                    name={`q-${activeQuestionKey}`}
                    checked={normalizeSelectedAnswer(selectedAnswer) === normalizeSelectedAnswer(option)}
                    onChange={() =>
                      setAnswers((previous) => ({
                        ...previous,
                        [activeQuestionKey]: option,
                      }))
                    }
                  />
                  {option}
                </label>
              ))}
            </div>
          ) : (
            <div className="error-banner">This question does not have 4 options and should not appear.</div>
          )}
        </div>

        <div className="test-controls">
          <button type="button" onClick={() => setCurrentIndex((previous) => Math.max(previous - 1, 0))} disabled={currentIndex === 0 || submitting}>
            Previous
          </button>

          {currentIndex < session.questionCount - 1 ? (
            <button type="button" onClick={() => setCurrentIndex((previous) => previous + 1)} disabled={submitting}>
              Next
            </button>
          ) : (
            <button type="button" onClick={submitSession} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Finish Test'}
            </button>
          )}
        </div>

        {error ? <div className="error-banner">{error}</div> : null}
      </div>
    </section>
  );
}

export default TestPage;
