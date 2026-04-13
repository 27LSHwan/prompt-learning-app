import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { clearAuth, setAuth } from '../lib/auth';
import type { LoginResponse } from '../types';

interface ValidationErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

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
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    try {
      const res = await api.post<LoginResponse>('/auth/login', {
        email: form.email,
        password: form.password,
      });
      if (res.data.role !== 'student') {
        clearAuth();
        setError('학생 계정만 로그인할 수 있습니다.');
        return;
      }
      setAuth(res.data.access_token, res.data.user_id, res.data.role, res.data.refresh_token);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('이메일 또는 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)',
      }}
    >
      {/* Left panel – branding */}
      <div
        style={{
          flex: isMobile ? 'none' : 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#fff',
          padding: isMobile ? '36px 24px 28px' : '60px 48px',
          gap: isMobile ? 14 : 20,
        }}
      >
        <div style={{ fontSize: isMobile ? 48 : 72 }} aria-hidden="true">🎓</div>
        <h1 style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, textAlign: 'center', lineHeight: 1.3 }}>
          AI 학습 도우미
        </h1>
        <p style={{ fontSize: isMobile ? 14 : 16, opacity: 0.85, textAlign: 'center', maxWidth: 320, lineHeight: 1.8 }}>
          나만의 학습 패턴을 분석하고<br />
          맞춤형 피드백으로 성장하세요
        </p>
        <div style={{ display: isMobile ? 'none' : 'flex', gap: 24, marginTop: 16 }}>
          {[
            { icon: '📊', text: '위험도 분석' },
            { icon: '💡', text: '맞춤 추천' },
            { icon: '📈', text: '성장 추적' },
          ].map(({ icon, text }) => (
            <div
              key={text}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: '14px 18px',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span style={{ fontSize: 24 }} aria-hidden="true">{icon}</span>
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel – form */}
      <div
        style={{
          width: isMobile ? '100%' : 440,
          maxWidth: isMobile ? 'none' : 440,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: isMobile ? '36px 24px 44px' : '48px 44px',
          boxShadow: isMobile ? '0 -8px 32px rgba(0,0,0,0.12)' : '-8px 0 40px rgba(0,0,0,0.12)',
          borderRadius: isMobile ? '28px 28px 0 0' : 0,
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, color: 'var(--text)' }}>
          로그인
        </h2>
        <p style={{ color: 'var(--text-sub)', marginBottom: 32, fontSize: 14 }}>
          계정에 로그인하고 학습을 시작하세요
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 6,
                color: 'var(--text)',
              }}
            >
              이메일
            </label>
            <input
              id="email"
              className="form-input"
              type="email"
              value={form.email}
              onChange={e => {
                setForm({ ...form, email: e.target.value });
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              placeholder="이메일을 입력하세요"
              aria-label="이메일"
              style={{
                borderColor: errors.email ? '#ef4444' : undefined,
              }}
            />
            {errors.email && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                {errors.email}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 6,
                color: 'var(--text)',
              }}
            >
              비밀번호
            </label>
            <input
              id="password"
              className="form-input"
              type="password"
              value={form.password}
              onChange={e => {
                setForm({ ...form, password: e.target.value });
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              placeholder="비밀번호를 입력하세요"
              aria-label="비밀번호"
              style={{
                borderColor: errors.password ? '#ef4444' : undefined,
              }}
            />
            {errors.password && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                {errors.password}
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              role="alert"
            >
              <span aria-hidden="true">❌</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              marginTop: 4,
              padding: '13px',
              fontSize: 16,
              opacity: loading ? 0.6 : 1,
            }}
            aria-label="로그인 버튼"
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block',
                  }}
                />
                로그인 중...
              </span>
            ) : (
              '🚀 로그인'
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-sub)' }}>
          아직 계정이 없으신가요?{' '}
          <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 700 }}>
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
