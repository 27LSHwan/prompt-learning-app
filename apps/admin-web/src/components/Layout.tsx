import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { clearAuth, isLoggedIn } from '../lib/auth';
import { useEffect, useState } from 'react';

const NAV = [
  { to: '/dashboard',          icon: '📊', label: '대시보드' },
  { to: '/students',           icon: '👥', label: '학생 목록' },
  { to: '/interventions-list', icon: '📋', label: '개입 현황' },
  { to: '/problems',           icon: '📝', label: '문제 관리' },
];

const isActivePath = (pathname: string, target: string) =>
  pathname === target || pathname.startsWith(`${target}/`) || pathname.startsWith(`${target}?`);

export default function Layout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside style={{
          width: 230, background: 'var(--sidebar-bg)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100,
        }}>
          {/* Logo */}
          <div style={{ padding: '24px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>🛡️</div>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>관리자 포털</div>
                <div style={{ color: '#475569', fontSize: 11 }}>운영 관리 페이지</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '8px 10px 4px', textTransform: 'uppercase' }}>
              메뉴
            </p>
            {NAV.map(({ to, icon, label }) => {
              const active = isActivePath(location.pathname, to);
              return (
                <Link key={to} to={to} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  background: active ? 'var(--sidebar-active)' : 'transparent',
                  color: active ? '#fff' : '#94a3b8',
                  fontWeight: active ? 700 : 400, fontSize: 14,
                  transition: 'all 0.12s',
                  borderLeft: active ? '3px solid #0ea5e9' : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'; (e.currentTarget as HTMLElement).style.color = '#cbd5e1'; } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; } }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom */}
          <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={handleLogout} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, border: 'none',
              background: 'transparent', color: '#64748b',
              fontSize: 13, cursor: 'pointer', transition: 'all 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.06)'); (e.currentTarget.style.color = '#94a3b8'); }}
            onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = '#64748b'); }}>
              <span>🚪</span> 로그아웃
            </button>
          </div>
        </aside>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 100,
          }}
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile sidebar */}
      {isMobile && (
        <aside style={{
          width: 230, background: 'var(--sidebar-bg)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 56, left: 0, height: 'calc(100vh - 56px)', zIndex: 101,
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
        }}>
          {/* Nav */}
          <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '8px 10px 4px', textTransform: 'uppercase' }}>
              메뉴
            </p>
            {NAV.map(({ to, icon, label }) => {
              const active = isActivePath(location.pathname, to);
              return (
                <Link key={to} to={to}
                  onClick={closeMobileMenu}
                  style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  background: active ? 'var(--sidebar-active)' : 'transparent',
                  color: active ? '#fff' : '#94a3b8',
                  fontWeight: active ? 700 : 400, fontSize: 14,
                  transition: 'all 0.12s',
                  borderLeft: active ? '3px solid #0ea5e9' : '3px solid transparent',
                }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom */}
          <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={handleLogout} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, border: 'none',
              background: 'transparent', color: '#64748b',
              fontSize: 13, cursor: 'pointer', transition: 'all 0.12s',
            }}>
              <span>🚪</span> 로그아웃
            </button>
          </div>
        </aside>
      )}

      {/* Content */}
      <div style={{ marginLeft: isMobile ? 0 : 230, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          height: 56, background: '#fff', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: isMobile ? '0 16px' : '0 32px',
          position: 'sticky', top: 0, zIndex: 50,
          justifyContent: isMobile ? 'space-between' : 'flex-start',
        }}>
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: 20,
                cursor: 'pointer',
                color: 'var(--text)',
              }}
            >
              ☰
            </button>
          )}
          <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>
            {NAV.find(n => isActivePath(location.pathname, n.to))?.label ?? '관리자 포털'}
          </span>
          <div style={{ marginLeft: isMobile ? 'auto' : 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 14, fontWeight: 700,
            }}>A</div>
          </div>
        </header>

        <main style={{ flex: 1, padding: isMobile ? '18px 14px 48px' : 'clamp(20px, 3vw, 28px) clamp(16px, 3vw, 32px) 60px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
