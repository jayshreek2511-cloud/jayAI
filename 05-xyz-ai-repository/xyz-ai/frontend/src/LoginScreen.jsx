import { useState } from 'react';

export default function LoginScreen({ onLogin, error, isLoading }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('student');

  function submit(event) {
    event.preventDefault();
    onLogin({ userId: userId.trim(), role });
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <div className="logo-icon">🤖</div>
          <div>
            <div className="logo-text"><span>XYZ </span><span className="ai">AI</span></div>
            <div className="logo-subtitle">School Assistant</div>
          </div>
        </div>

        <div className="login-heading">
          <h1 id="login-title">Sign in</h1>
          <p>Use your school User ID and role to access your dashboard.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            User ID
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="e.g. student-001"
              autoComplete="username"
              required
              disabled={isLoading}
            />
          </label>
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value)} disabled={isLoading}>
              <option value="student">Student</option>
              <option value="parent">Parent</option>
              <option value="teacher">Teacher</option>
              <option value="principal">Principal</option>
            </select>
          </label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="login-submit" type="submit" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
