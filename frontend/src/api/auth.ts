import axios from 'axios';
import type { AuthUser } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function getGoogleAuthUrl(): Promise<string> {
  const { data } = await api.get<{ url: string }>('/auth/google/url');
  return data.url;
}

export async function googleCallback(code: string): Promise<{ token: string; user: AuthUser }> {
  const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/google/callback', { code });
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  const token = localStorage.getItem('auth_token');
  const { data } = await api.get<AuthUser>('/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
}
