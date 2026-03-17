import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { googleCallback, fetchMe } from '../api/auth';
import type { AuthUser, Issue } from '../api/types';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  loginWithGoogleCode: (code: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isLeaderOf: (teamId: string) => boolean;
  isWorkerOf: (teamId: string) => boolean;
  canManageTeam: (teamId: string) => boolean;
  canEditIssue: (issue: Issue) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    fetchMe()
      .then((userData) => {
        setUser(userData);
      })
      .catch(() => {
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  const loginWithGoogleCode = useCallback(async (code: string) => {
    const result = await googleCallback(code);
    localStorage.setItem('auth_token', result.token);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.is_admin ?? false;

  const isLeaderOf = useCallback(
    (teamId: string) => user?.roles[teamId] === 'leader',
    [user]
  );

  const isWorkerOf = useCallback(
    (teamId: string) => user?.roles[teamId] === 'worker',
    [user]
  );

  const canManageTeam = useCallback(
    (teamId: string) => isAdmin || (user?.roles[teamId] === 'leader'),
    [isAdmin, user]
  );

  const canEditIssue = useCallback(
    (issue: Issue) => {
      if (isAdmin) return true;
      if (issue.team_id && user?.roles[issue.team_id] === 'leader') return true;
      // Check multi-assignees by slack_user_id (both must be truthy to avoid undefined===undefined)
      if (user?.slack_user_id && issue.assignees?.some((a: { slack_user_id?: string }) =>
        a.slack_user_id && a.slack_user_id === user.slack_user_id
      )) return true;
      // Check primary assignee by name — this is a UI hint only; backend enforces real permission via email match
      if (issue.assignee_name && user?.name && issue.assignee_name === user.name) return true;
      return false;
    },
    [isAdmin, user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        loginWithGoogleCode,
        logout,
        isAdmin,
        isLeaderOf,
        isWorkerOf,
        canManageTeam,
        canEditIssue,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
