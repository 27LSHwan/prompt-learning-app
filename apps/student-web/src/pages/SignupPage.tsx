import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';

interface ValidationErrors {
  username?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!form.username.trim()) {
      newErrors.username = '아이디를 입력해주세요.';
    } else if (form.username.length < 2) {
      newErrors.username = '아이디는 최소 2자 이상이어야 합니다.';
    }

    if (!form.email.trim()) {
      newErrors.email = '이메일을 입력해주세요.';
    } else if (!EMAIL_REGEX.test(form.email)) {
      newErrors.email = '유효한 이메일 주소를 입력해주세요.';
    }

    if (!form.password) {
      newErrors.password = '비밀번호를 입력해주세요.';
    } else if (form.password.length < 6) {
      newErrors.password = '비밀번호는 최소 6자 이상이어야 합니다.';
    }

    if (!form.confirm) {
      newErrors.confirm = '비밀번호 확인을 입력해주세요.';
    } else if (form.password !== form.confirm) {
      newErrors.confirm = '비밀번호가 일치하지 않습니다.';
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
      await api.post('/auth/signup', {
        username: form.username,
        email: form.email,
        password: form.password,
        role: 'student',
      });
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(
        err.response?.data?.detail ?? '회원가입에 실패했습니다. 다시 시도해주세요.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    {
      key: 'username' as const,
      label: '아이디',
      type: 'text',
      ph: '영문/숫자로 입력',
      icon: '👤',
    },
    {
      key: 'email' as const,
      label: '이메일',
      type: 'email',
      ph: 'example@email.com',
      icon: '📧',
    },
    {
      key: 'password' as const,
      label: '비밀번호',
      type: 'password',
      ph: '6자 이상',
      icon: '🔒',
    },
    {
      key: 'confirm' as const,
      label: '비밀번호 확인',
      type: 'password',
      ph: '비밀번호를 다시 입력',
      icon: '🔒',
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eaf6 100%)',
        padding: '40px 16px',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '48px 44px',
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 8px 40px rgba(79,70,229,0.12)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden="true">🌱</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
            회원가입
          </h2>
          <p style={{ color: 'var(--text-sub)', fontSize: 14 }}>
            계정을 만들고 AI 학습을 시작하세요
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fields.map(({ key, label, type, ph, icon }) => (
            <div key={key}>
              <label
                htmlFor={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 6,
                  color: 'var(--text)',
                }}
              >
                <span aria-hidden="true">{icon}</span> {label}
              </label>
              <input
                id={key}
                className="form-input"
                type={type}
                value={form[key]}
                onChange={e => {
                  setForm(f => ({ ...f, [key]: e.target.value }));
                  if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
                }}
                placeholder={ph}
                aria-label={label}
                style={{
                  borderColor: errors[key] ? '#ef4444' : undefined,
                }}
              />
              {errors[key] && (
                <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                  {errors[key]}
                </div>
              )}
            </div>
          ))}

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
              marginTop: 6,
              padding: '13px',
              fontSize: 16,
              opacity: loading ? 0.6 : 1,
            }}
            aria-label="가입하기 버튼"
          >
            {loading ? '처리 중...' : '✅ 가입하기'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-sub)' }}>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700 }}>
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
