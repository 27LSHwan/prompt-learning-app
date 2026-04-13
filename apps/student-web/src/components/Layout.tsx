import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { clearAuth, getRole, isLoggedIn } from '../lib/auth';
import { useEffect, useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationModal } from './NotificationModal';

const NAV_ITEMS = [
  { to: '/dashboard', icon: '🏠', label: '홈' },
  { to: '/problems',  icon: '📝', label: '문제 풀기' },
  { to: '/history',   icon: '📋', label: '제출 이력' },
  { to: '/risk',      icon: '📊', label: '위험도' },
  { to: '/recommend', icon: '💡', label: '학습 추천' },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const studentId = localStorage.getItem('student_id');
  const suppressNotificationAutoOpen = /^\/submissions\/[^/]+\/result$/.test(location.pathname);
  const { unreadCount, showModal, openModal, closeModal } = useNotifications(studentId, { autoOpen: !suppressNotificationAutoOpen });

  useEffect(() => {
    if (!isLoggedIn() || getRole() !== 'student') {
      clearAuth();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (suppressNotificationAutoOpen && showModal) {
      closeModal();
    }
  }, [suppressNotificationAutoOpen, showModal, closeModal]);

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  const closeMobileMenu = () => {
    setIsMobileOpen(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'column' }}>
      {/* Mobile header (visible on small screens) */}
      <div style={{
        display: 'none',
        height: 56,
        background: '#fff',
        borderBottom: '1px solid var(--border)',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }} className="mobile-header">
        <div style={{ fontSize: 20 }}>🎓</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={openModal}
            style={{
              position: 'relative',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '22px',
              padding: '4px 8px',
            }}
            title="알림"
          >
            🔔
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                background: '#FF4B4B',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                fontSize: '10px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              padding: 0,
            }}
            aria-label="메뉴 열기"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 40,
            display: 'none,',
          }}
          className="mobile-overlay"
          onClick={closeMobileMenu}
        />
      )}

      <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        {/* Sidebar */}
        <aside style={{
          width: 220,
          background: 'linear-gradient(180deg, #4f46e5 0%, #3730a3 100%)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: 100,
          boxShadow: '4px 0 24px rgba(79,70,229,0.2)',
        }} className="sidebar">
          {/* Logo */}
          <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>🎓</div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1.3 }}>
              AI 학습<br />
              <span style={{ color: '#a5b4fc', fontWeight: 500, fontSize: 13 }}>학습 도우미</span>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV_ITEMS.map(({ to, icon, label }) => {
              const active = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={closeMobileMenu}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '11px 14px',
                    borderRadius: 10,
                    background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,0.72)',
                    fontWeight: active ? 700 : 500,
                    fontSize: 14,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)';
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden="true">{icon}</span>
                  {label}
                  {active && <span style={{ marginLeft: 'auto', width: 6, height: 6, background: '#a5b4fc', borderRadius: '50%' }} />}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: 'rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.8)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.20)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
            >
              <span aria-hidden="true">🚪</span> 로그아웃
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main
          style={{
            marginLeft: 220,
            flex: 1,
            padding: 'clamp(20px, 3vw, 36px) clamp(16px, 3vw, 36px) 60px',
            minWidth: 0,
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* Notification bell in desktop header */}
      <button
        onClick={openModal}
        style={{
          position: 'fixed',
          top: 28,
          right: 28,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '22px',
          padding: '4px 8px',
          zIndex: 99,
        }}
        title="알림"
        className="desktop-notification-bell"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            background: '#FF4B4B',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '10px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification modal */}
      {showModal && studentId && (
        <NotificationModal studentId={studentId} onClose={closeModal} />
      )}

      <style>{`
        @media (max-width: 768px) {
          .mobile-header {
            display: flex !important;
          }
          .desktop-notification-bell {
            display: none !important;
          }
          .sidebar {
            top: 56px !important;
            height: calc(100vh - 56px) !important;
            left: ${isMobileOpen ? '0' : '-100%'} !important;
            transition: left 0.3s ease !important;
            width: 100% !important;
            max-width: 280px !important;
          }
          .mobile-overlay {
            display: block !important;
          }
          main {
            margin-left: 0 !important;
            padding: 20px 14px 48px !important;
          }
        }
      `}</style>
    </div>
  );
}
