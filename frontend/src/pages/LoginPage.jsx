import { useState } from 'react';

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onLogin({ email, password });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-header">
        <div className="login-badge" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3L19 6V11.2C19 15.77 16.02 20.03 12 21.25C7.98 20.03 5 15.77 5 11.2V6L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1>Admin Login</h1>
        <p>Placement Test Platform</p>
      </div>

      <form className="login-card" onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <div className="login-input-wrap">
          <span className="login-input-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6H20V18H4V6Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 8L12 13L20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <label htmlFor="password">Password</label>
        <div className="login-input-wrap">
          <span className="login-input-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 10V7.5C7 4.74 9.24 2.5 12 2.5C14.76 2.5 17 4.74 17 7.5V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </span>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in' : 'Sign in'}
        </button>
      </form>

      <p className="login-footer">Authorized personnel only</p>
    </div>
  );
}

export default LoginPage;
