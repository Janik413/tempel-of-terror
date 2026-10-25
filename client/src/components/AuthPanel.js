import React, { useState } from 'react';

/**
 * Login / registration box on the home screen.
 * Logged out players can always play as guest; an account only adds statistics.
 */
function AuthPanel({ auth, onShowProfile, onShowLeaderboard }) {
  const [mode, setMode] = useState(null); // null | 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  if (auth.isLoading) return <div className="auth-panel">Loading account...</div>;

  if (auth.user) {
    return (
      <div className="auth-panel logged-in">
        <span className="auth-user">
          👤 <strong>{auth.user.username || auth.user.email}</strong>
        </span>
        <div className="auth-actions">
          <button type="button" className="btn btn-small" onClick={onShowProfile}>
            📊 My Stats
          </button>
          <button type="button" className="btn btn-small btn-secondary" onClick={onShowLeaderboard}>
            🏆 Leaderboard
          </button>
          <button type="button" className="btn btn-small btn-secondary" onClick={auth.signOut}>
            Log out
          </button>
        </div>
      </div>
    );
  }

  const submit = async event => {
    event.preventDefault();
    setError('');
    setInfo('');
    setIsBusy(true);
    const result = mode === 'login' ? await auth.signIn(email, password) : await auth.signUp(email, password, username);
    setIsBusy(false);

    if (result.error) {
      setError(result.error);
    } else if (result.needsConfirmation) {
      setInfo('Almost done! Please confirm your email address with the link we sent you, then log in.');
      setMode('login');
    } else {
      setMode(null);
      setPassword('');
    }
  };

  if (!mode) {
    return (
      <div className="auth-panel">
        <span className="auth-hint">Playing as guest – log in to track your wins and stats</span>
        <div className="auth-actions">
          <button type="button" className="btn btn-small" onClick={() => setMode('login')}>
            Log in
          </button>
          <button type="button" className="btn btn-small btn-secondary" onClick={() => setMode('register')}>
            Create account
          </button>
          <button type="button" className="btn btn-small btn-secondary" onClick={onShowLeaderboard}>
            🏆
          </button>
        </div>
        {info && <div className="auth-info">{info}</div>}
      </div>
    );
  }

  return (
    <form className="auth-panel auth-form" onSubmit={submit}>
      <h4>{mode === 'login' ? 'Log in' : 'Create account'}</h4>
      {mode === 'register' && (
        <input
          type="text"
          className="input-field"
          placeholder="Username (shown in games)"
          value={username}
          onChange={event => setUsername(event.target.value)}
          maxLength={20}
          autoComplete="username"
          required
        />
      )}
      <input
        type="email"
        className="input-field"
        placeholder="Email"
        value={email}
        onChange={event => setEmail(event.target.value)}
        autoComplete="email"
        required
      />
      <input
        type="password"
        className="input-field"
        placeholder="Password"
        value={password}
        onChange={event => setPassword(event.target.value)}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        required
      />
      {error && <div className="error-message">{error}</div>}
      {info && <div className="auth-info">{info}</div>}
      <div className="auth-actions">
        <button type="submit" className="btn btn-small" disabled={isBusy}>
          {isBusy ? '...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <button
          type="button"
          className="btn btn-small btn-secondary"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'No account yet?' : 'Already registered?'}
        </button>
        <button type="button" className="btn btn-small btn-secondary" onClick={() => setMode(null)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default AuthPanel;
