const TOKEN_KEY = 'admin_token';
const USER_ID_KEY = 'admin_user_id';
const ROLE_KEY = 'admin_role';
const REFRESH_TOKEN_KEY = 'refresh_token';

export function saveAuth(token: string, userId: string, role: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, userId);
  localStorage.setItem(ROLE_KEY, role);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function setAuth(token: string, userId: string, role = 'admin', refreshToken?: string): void {
  saveAuth(token, userId, role, refreshToken);
}

export function clearAuth(): void {
  [TOKEN_KEY, USER_ID_KEY, ROLE_KEY, REFRESH_TOKEN_KEY].forEach(k => localStorage.removeItem(k));
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function getRole(): string | null {
  return localStorage.getItem(ROLE_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
