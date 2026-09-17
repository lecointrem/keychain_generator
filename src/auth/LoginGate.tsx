import { useState, type FormEvent, type ReactNode } from 'react';
import { ACCOUNTS } from './accounts';
import { sha256Hex } from './hash';
import './LoginGate.css';

const STORAGE_KEY = 'keychain-auth-user';

function getStoredUser(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function LoginGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(() => getStoredUser());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
      const hash = await sha256Hex(password);
      const account = ACCOUNTS.find(
        (a) => a.username.toLowerCase() === username.trim().toLowerCase() && a.passwordHash === hash,
      );
      if (!account) {
        setError('Identifiants invalides.');
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, account.username);
      } catch {
        // localStorage unavailable (private browsing, etc.) — still let the session through.
      }
      setUser(account.username);
    } finally {
      setChecking(false);
    }
  }

  function handleLogout() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setUser(null);
    setUsername('');
    setPassword('');
  }

  if (!user) {
    return (
      <div className="login-gate">
        <form className="login-card" onSubmit={handleSubmit}>
          <h1>Générateur de porte-clés</h1>
          <p className="login-hint">Accès restreint.</p>
          <label>
            <span>Identifiant</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            <span>Mot de passe</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={checking}>
            {checking ? 'Vérification…' : 'Se connecter'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <button className="logout-button" type="button" onClick={handleLogout} title={`Connecté en tant que ${user}`}>
        Déconnexion
      </button>
      {children}
    </>
  );
}
