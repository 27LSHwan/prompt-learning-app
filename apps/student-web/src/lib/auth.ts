export const getToken = () => localStorage.getItem('token');
export const getUserId = () => localStorage.getItem('student_id');
export const getRole = () => localStorage.getItem('role');
export const getRefreshToken = () => localStorage.getItem('refresh_token');

export const setAuth = (
  token: string,
  studentId: string,
  role = 'student',
  refreshToken?: string
) => {
  localStorage.setItem('token', token);
  localStorage.setItem('student_id', studentId);
  localStorage.setItem('role', role);
  if (refreshToken) {
    localStorage.setItem('refresh_token', refreshToken);
  }
};

export const saveAuth = (token: string, userId: string, role: string) => {
  localStorage.setItem('token', token);
  localStorage.setItem('student_id', userId);
  localStorage.setItem('role', role);
};

export const clearAuth = () => {
  ['token', 'student_id', 'role', 'refresh_token'].forEach(key =>
    localStorage.removeItem(key)
  );
};

export const isLoggedIn = () => !!getToken();
