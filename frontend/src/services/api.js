const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthToken = () => localStorage.getItem('authToken');
const isLocalDevelopment = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/i.test(window.location.hostname);

const request = async (path, options = {}) => {
  const token = getAuthToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
};

export const api = {
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  getAnalytics: () => request('/dashboard/analytics'),
  getSubmissionMonth: ({ month, year }) => request(`/dashboard/submissions?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`),
  getDashboardNote: () => request('/dashboard/note'),
  saveDashboardNote: (payload) => request('/dashboard/note', { method: 'PUT', body: JSON.stringify(payload) }),
  listTestTables: () => request('/test/tables'),
  startTest: (payload) => request('/test/start', { method: 'POST', body: JSON.stringify(payload) }),
  submitTest: (payload) => request('/test/submit', { method: 'POST', body: JSON.stringify(payload) }),
  getTestHistory: () => request('/test/history'),
  askAiDoubt: async (payload) => {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const aiUrl = isLocalDevelopment ? `${API_BASE_URL}/ai/doubt` : '/api/ai';
    const response = await fetch(aiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  },
  updateTestQuestion: (payload) => request('/test/question', { method: 'PUT', body: JSON.stringify(payload) }),
  uploadCsv: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/upload/csv', { method: 'POST', body: formData });
  },
};
