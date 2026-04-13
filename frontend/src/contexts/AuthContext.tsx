import React, { createContext, useReducer, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'professor' | 'member';
  email?: string | null;
  phone?: string | null;
  department?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
}

type AuthAction =
  | { type: 'SET_AUTH'; payload: { user: AuthUser; token: string } }
  | { type: 'CLEAR_AUTH' }
  | { type: 'SET_LOADING'; payload: boolean };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_AUTH':
      return { ...state, user: action.payload.user, token: action.payload.token, loading: false };
    case 'CLEAR_AUTH':
      return { user: null, token: null, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    token: localStorage.getItem('token'),
    loading: true,
  });

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    delete api.defaults.headers.common['Authorization'];
    dispatch({ type: 'CLEAR_AUTH' });
  }, []);

  // Restore session from stored token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    api.get('/api/auth/me')
      .then((res) => {
        dispatch({ type: 'SET_AUTH', payload: { user: res.data, token } });
      })
      .catch(() => {
        // Try refresh
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          logout();
          return;
        }

        api.post('/api/auth/refresh', { refreshToken })
          .then((res) => {
            const { token: newToken } = res.data;
            localStorage.setItem('token', newToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            return api.get('/api/auth/me');
          })
          .then((res) => {
            const newToken = localStorage.getItem('token')!;
            dispatch({ type: 'SET_AUTH', payload: { user: res.data, token: newToken } });
          })
          .catch(() => logout());
      });
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post('/api/auth/login', { username, password });
    const { token, refreshToken, user } = res.data;

    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    dispatch({ type: 'SET_AUTH', payload: { user, token } });
  }, []);

  return (
    <AuthContext.Provider value={{ user: state.user, token: state.token, loading: state.loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
