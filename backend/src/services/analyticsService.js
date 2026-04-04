const { pool, ensureDbConnection } = require('../config/db');

const ANALYTICS_CACHE_TTL_MS = 30 * 1000;
let analyticsCache = null;
let analyticsCacheAt = 0;
const TEST_SESSIONS_TABLE = 'test_sessions';

const buildEmptySubmissionCalendar = () => {
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

  return {
    days,
    totalSubmissions: 0,
    activeDays: 0,
    maxStreak: 0,
    currentStreak: 0,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  };
};

const buildEmptyAnalyticsSnapshot = () => ({
  totalTables: 0,
  totalRows: 0,
  questionTableCount: 0,
  questionRowCount: 0,
  testSessionCount: 0,
  avgScore: 0,
  avgDurationMinutes: 0,
  submissionCalendar: buildEmptySubmissionCalendar(),
  tableDetails: [],
});

const buildEmptySubmissionMonthSnapshot = (month, year) => {
  const safeMonth = Math.min(Math.max(Number(month) || 1, 1), 12);
  const safeYear = Math.min(Math.max(Number(year) || new Date().getUTCFullYear(), 2000), 2100);
  const monthStart = new Date(Date.UTC(safeYear, safeMonth - 1, 1));
  const monthEnd = new Date(Date.UTC(safeYear, safeMonth, 0));

  const days = [];
  for (let cursor = new Date(monthStart); cursor <= monthEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    days.push({
      date: cursor.toISOString().slice(0, 10),
      submissions: 0,
    });
  }

  return {
    year: safeYear,
    month: safeMonth,
    monthName: monthStart.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }),
    availableYears: [safeYear],
    days,
    totalSubmissions: 0,
    activeDays: 0,
    maxStreak: 0,
    currentStreak: 0,
    startDate: monthStart.toISOString().slice(0, 10),
    endDate: monthEnd.toISOString().slice(0, 10),
  };
};

const getPublicTables = async () => {
  ensureDbConnection();

  try {
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const { rows } = await pool.query(query);
    return rows.map((row) => row.table_name);
  } catch (error) {
    error.statusCode = error.statusCode || 503;
    error.message = 'Unable to connect to Supabase Postgres. Check the database URL, network access, and Supabase connection settings.';
    throw error;
  }
};

const getTableColumnNames = async (tableName) => {
  ensureDbConnection();

  try {
    const query = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `;

    const { rows } = await pool.query(query, [tableName]);
    return rows.map((row) => row.column_name);
  } catch (error) {
    error.statusCode = error.statusCode || 503;
    error.message = 'Unable to connect to Supabase Postgres. Check the database URL, network access, and Supabase connection settings.';
    throw error;
  }
};

const getSubmissionActivity = async () => {
  try {
    ensureDbConnection();

    const query = `
      SELECT
        DATE(completed_at AT TIME ZONE 'UTC') AS activity_date,
        COUNT(*)::int AS submissions
      FROM ${TEST_SESSIONS_TABLE}
      WHERE completed_at IS NOT NULL
        AND completed_at >= NOW() - INTERVAL '365 days'
      GROUP BY 1
      ORDER BY 1;
    `;

    const { rows } = await pool.query(query);
    return rows.map((row) => ({
      date: row.activity_date instanceof Date ? row.activity_date.toISOString().slice(0, 10) : String(row.activity_date),
      submissions: Number(row.submissions) || 0,
    }));
  } catch (error) {
    return [];
  }
};

const buildSubmissionCalendar = (activityRows) => {
  const today = new Date();
  const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - 364);

  const activityMap = new Map(activityRows.map((row) => [row.date, row.submissions]));
  const days = [];

  for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dateKey = cursor.toISOString().slice(0, 10);
    days.push({
      date: dateKey,
      submissions: activityMap.get(dateKey) || 0,
    });
  }

  const activeDays = days.filter((day) => day.submissions > 0).length;
  const totalSubmissions = days.reduce((sum, day) => sum + day.submissions, 0);

  let maxStreak = 0;
  let currentStreak = 0;
  let rollingStreak = 0;

  for (const day of days) {
    if (day.submissions > 0) {
      rollingStreak += 1;
      if (rollingStreak > maxStreak) {
        maxStreak = rollingStreak;
      }
    } else {
      rollingStreak = 0;
    }
  }

  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (days[index].submissions > 0) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  return {
    days,
    totalSubmissions,
    activeDays,
    maxStreak,
    currentStreak,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  };
};

const getAnalyticsSnapshot = async () => {
  const now = Date.now();
  if (analyticsCache && now - analyticsCacheAt < ANALYTICS_CACHE_TTL_MS) {
    return analyticsCache;
  }

  try {
    ensureDbConnection();

    let rows;
    const query = `
      WITH table_list AS (
        SELECT
          c.relname AS table_name,
          COALESCE(
            s.n_live_tup::bigint,
            GREATEST(c.reltuples, 0)::bigint,
            0::bigint
          ) AS row_count,
          GREATEST(
            COALESCE(s.last_vacuum, 'epoch'::timestamptz),
            COALESCE(s.last_autovacuum, 'epoch'::timestamptz),
            COALESCE(s.last_analyze, 'epoch'::timestamptz),
            COALESCE(s.last_autoanalyze, 'epoch'::timestamptz)
          ) AS last_activity_at
        FROM pg_class c
        INNER JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
      ),
      column_list AS (
        SELECT
          table_name,
          array_agg(column_name ORDER BY ordinal_position) AS columns
        FROM information_schema.columns
        WHERE table_schema = 'public'
        GROUP BY table_name
      )
      SELECT
        t.table_name,
        t.row_count,
        t.last_activity_at,
        COALESCE(array_length(c.columns, 1), 0) AS column_count,
        COALESCE(c.columns, ARRAY[]::text[]) AS columns
      FROM table_list t
      LEFT JOIN column_list c ON c.table_name = t.table_name
      ORDER BY t.table_name;
    `;

    const result = await pool.query(query);
    rows = result.rows;
  
    const tableDetails = rows.map((row) => ({
      tableName: row.table_name,
      rowCount: Number(row.row_count) || 0,
      lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at).toISOString() : null,
      columnCount: Number(row.column_count) || 0,
      columns: Array.isArray(row.columns) ? row.columns : [],
    }));

    const totalRows = tableDetails.reduce((sum, table) => sum + table.rowCount, 0);

    const questionTables = tableDetails.filter((table) => table.tableName !== TEST_SESSIONS_TABLE);
    const questionRowCount = questionTables.reduce((sum, table) => sum + table.rowCount, 0);

    let avgScore = 0;
    let avgDurationMinutes = 0;
    let testSessionCount = 0;
    let submissionCalendar = buildEmptySubmissionCalendar();

    if (tableDetails.some((table) => table.tableName === TEST_SESSIONS_TABLE)) {
      try {
        const metricsQuery = `
          SELECT
            COUNT(*)::int AS test_session_count,
            COALESCE(
              ROUND(AVG(
                CASE
                  WHEN total_marks > 0 AND obtained_marks IS NOT NULL
                  THEN (obtained_marks::numeric * 100.0 / total_marks)
                END
              )::numeric, 2),
              0
            ) AS avg_score,
            COALESCE(ROUND(AVG(duration_minutes)::numeric, 2), 0) AS avg_duration_minutes
          FROM ${TEST_SESSIONS_TABLE};
        `;

        const metricsResult = await pool.query(metricsQuery);
        const metrics = metricsResult.rows[0] || {};
        testSessionCount = Number(metrics.test_session_count) || 0;
        avgScore = Number(metrics.avg_score) || 0;
        avgDurationMinutes = Number(metrics.avg_duration_minutes) || 0;

        const activityRows = await getSubmissionActivity();
        submissionCalendar = activityRows.length ? buildSubmissionCalendar(activityRows) : buildEmptySubmissionCalendar();
      } catch (error) {
        submissionCalendar = buildEmptySubmissionCalendar();
      }
    }

    const snapshot = {
      totalTables: tableDetails.length,
      totalRows,
      questionTableCount: questionTables.length,
      questionRowCount,
      testSessionCount,
      avgScore,
      avgDurationMinutes,
      submissionCalendar,
      tableDetails,
    };

    analyticsCache = snapshot;
    analyticsCacheAt = now;

    return snapshot;
  } catch (error) {
    const snapshot = buildEmptyAnalyticsSnapshot();
    analyticsCache = snapshot;
    analyticsCacheAt = now;
    return snapshot;
  }
};

const getSubmissionMonthSnapshot = async ({ month, year }) => {
  try {
    ensureDbConnection();

    const now = new Date();
    const safeMonth = Math.min(Math.max(Number(month) || now.getUTCMonth() + 1, 1), 12);
    const safeYear = Math.min(Math.max(Number(year) || now.getUTCFullYear(), 2000), 2100);

    const monthStart = new Date(Date.UTC(safeYear, safeMonth - 1, 1));
    const monthEnd = new Date(Date.UTC(safeYear, safeMonth, 0));

    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS table_exists;
    `;

    const tableExistsResult = await pool.query(tableExistsQuery, [TEST_SESSIONS_TABLE]);
    const tableExists = Boolean(tableExistsResult.rows[0]?.table_exists);

    if (!tableExists) {
      return buildEmptySubmissionMonthSnapshot(safeMonth, safeYear);
    }

    const days = [];
    for (let cursor = new Date(monthStart); cursor <= monthEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      days.push({
        date: cursor.toISOString().slice(0, 10),
        submissions: 0,
      });
    }

    const activityQuery = `
      SELECT
        DATE(completed_at AT TIME ZONE 'UTC') AS activity_date,
        COUNT(*)::int AS submissions
      FROM ${TEST_SESSIONS_TABLE}
      WHERE completed_at IS NOT NULL
        AND EXTRACT(YEAR FROM completed_at AT TIME ZONE 'UTC') = $1
        AND EXTRACT(MONTH FROM completed_at AT TIME ZONE 'UTC') = $2
      GROUP BY 1
      ORDER BY 1;
    `;

    const yearsQuery = `
      SELECT DISTINCT EXTRACT(YEAR FROM completed_at AT TIME ZONE 'UTC')::int AS year
      FROM ${TEST_SESSIONS_TABLE}
      WHERE completed_at IS NOT NULL
      ORDER BY year DESC;
    `;

    const [activityResult, yearsResult] = await Promise.all([
      pool.query(activityQuery, [safeYear, safeMonth]),
      pool.query(yearsQuery),
    ]);

    const activityMap = new Map(
      activityResult.rows.map((row) => [
        row.activity_date instanceof Date ? row.activity_date.toISOString().slice(0, 10) : String(row.activity_date),
        Number(row.submissions) || 0,
      ])
    );

    const hydratedDays = days.map((day) => ({
      ...day,
      submissions: activityMap.get(day.date) || 0,
    }));

    const totalSubmissions = hydratedDays.reduce((sum, day) => sum + day.submissions, 0);
    const activeDays = hydratedDays.filter((day) => day.submissions > 0).length;

    let maxStreak = 0;
    let rollingStreak = 0;
    for (const day of hydratedDays) {
      if (day.submissions > 0) {
        rollingStreak += 1;
        if (rollingStreak > maxStreak) {
          maxStreak = rollingStreak;
        }
      } else {
        rollingStreak = 0;
      }
    }

    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const isCurrentMonth = safeYear === todayUtc.getUTCFullYear() && safeMonth === todayUtc.getUTCMonth() + 1;
    const streakDays = isCurrentMonth
      ? hydratedDays.filter((day) => new Date(`${day.date}T00:00:00Z`) <= todayUtc)
      : hydratedDays;

    let currentStreak = 0;
    for (let index = streakDays.length - 1; index >= 0; index -= 1) {
      if (streakDays[index].submissions > 0) {
        currentStreak += 1;
      } else {
        break;
      }
    }

    const availableYears = yearsResult.rows.map((row) => Number(row.year)).filter(Boolean);
    if (!availableYears.includes(safeYear)) {
      availableYears.push(safeYear);
      availableYears.sort((a, b) => b - a);
    }

    return {
      year: safeYear,
      month: safeMonth,
      monthName: monthStart.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }),
      availableYears,
      days: hydratedDays,
      totalSubmissions,
      activeDays,
      maxStreak,
      currentStreak,
      startDate: monthStart.toISOString().slice(0, 10),
      endDate: monthEnd.toISOString().slice(0, 10),
    };
  } catch (error) {
    return buildEmptySubmissionMonthSnapshot(month, year);
  }
};

module.exports = {
  getPublicTables,
  getTableColumnNames,
  getAnalyticsSnapshot,
  getSubmissionMonthSnapshot,
};
