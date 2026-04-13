import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { clearAuth, setAuth } from '../lib/auth';
import type { LoginResponse } from '../types';

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [errors, setErrors]   = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.email.trim()) {
      newErrors.email = '이메일을 입력해주세요.';
    }

    if (!form.password) {
      newErrors.password = '비밀번호를 입력해주세요.';
    } else if (form.password.length < 6) {
      newErrors.password = '비밀번호는 최소 6자 이상이어야 합니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const res = await api.post<LoginResponse>('/auth/login', {
        email: form.email,
        password: form.password,
      });
      if (res.data.role !== 'admin') {
        clearAuth();
        setErrors({ general: '관리자 계정만 로그인할 수 있습니다.' });
        return;
      }
      setAuth(res.data.access_token, res.data.user_id, res.data.role, res.data.refresh_token);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        setErrors({ general: '백엔드에 연결할 수 없습니다. 서버와 CORS 설정을 확인하세요.' });
      } else {
        setErrors({ general: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      background: 'var(--sidebar-bg)',
    }}>
      {/* Left decorative panel */}
      <div style={{
        flex: isMobile ? 'none' : 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', padding: isMobile ? '36px 24px 28px' : '60px 48px', color: '#fff', gap: 20,
      }}>
        <div style={{ maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{
            width: isMobile ? 48 : 56, height: isMobile ? 48 : 56, borderRadius: 16, marginBottom: isMobile ? 18 : 28,
            background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 24 : 28,
          }} aria-hidden="true">🛡️</div>
          <h1 style={{ fontSize: isMobile ? 26 : 30, fontWeight: 800, marginBottom: 12, lineHeight: 1.3 }}>
            관리자<br />페이지
          </h1>
          <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.8, marginBottom: 40 }}>
            주요 현황을 확인하고<br />
            운영 데이터를 관리하세요.
          </p>

          <div style={{ display: isMobile ? 'none' : 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 280 }}>
            {[
              { icon: '📊', text: '대시보드 현황 확인' },
              { icon: '👥', text: '사용자 및 목록 관리' },
              { icon: '🛠️', text: '운영 항목 처리' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#94a3b8', fontSize: 14 }}>
                <span style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(14,165,233,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }} aria-hidden="true">{icon}</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div style={{
        width: isMobile ? '100%' : 420, background: '#fff',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: isMobile ? '36px 24px 44px' : '48px 44px',
        boxShadow: isMobile ? '0 -8px 32px rgba(0,0,0,0.2)' : '-8px 0 40px rgba(0,0,0,0.2)',
        borderRadius: isMobile ? '28px 28px 0 0' : 0,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>관리자 로그인</h2>
        <p style={{ color: 'var(--text-sub)', fontSize: 13, marginBottom: 32 }}>
          관리자 계정으로 로그인하세요
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { k: 'email', label: '이메일', type: 'email', ph: '관리자 이메일' },
            { k: 'password', label: '비밀번호', type: 'password', ph: '비밀번호' },
          ].map(({ k, label, type, ph }) => (
            <div key={k}>
              <label
                htmlFor={`field-${k}`}
                style={{ display: 'block', fontWeight: 700, fontSize: 12, marginBottom: 6, color: 'var(--text)' }}>
                {label}
              </label>
              <input
                id={`field-${k}`}
                className="form-input"
                type={type}
                value={(form as any)[k]}
                onChange={e => {
                  setForm(f => ({ ...f, [k]: e.target.value }));
                  if (errors[k as keyof FormErrors]) {
                    setErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors[k as keyof FormErrors];
                      return newErrors;
                    });
                  }
                }}
                placeholder={ph}
                aria-label={label}
                aria-invalid={!!errors[k as keyof FormErrors]}
                aria-describedby={errors[k as keyof FormErrors] ? `error-${k}` : undefined}
              />
              {errors[k as keyof FormErrors] && (
                <div
                  id={`error-${k}`}
                  style={{
                    color: '#ef4444',
                    fontSize: 12,
                    marginTop: 6,
                  }}
                  role="alert"
                >
                  {errors[k as keyof FormErrors]}
                </div>
              )}
            </div>
          ))}

          {errors.general && (
            <div style={{
              background: '#fef2f2', color: '#991b1b', padding: '9px 12px',
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }} role="alert">
              ❌ {errors.general}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ marginTop: 4, padding: '11px', fontSize: 14 }}
            aria-label="로그인 버튼"
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                  animation: 'spin 0.7s linear infinite', display: 'inline-block',
                }} aria-hidden="true" />
                로그인 중...
              </span>
            ) : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
