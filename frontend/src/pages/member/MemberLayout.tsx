import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { NbslLogo } from '../../components/ui/NbslLogo';
import { useLanguage, LangToggleButton } from '../../contexts/LanguageContext';
import { HelpButton } from '../../components/ui/HelpPanel';

export default function MemberLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NAV_ITEMS = [
    { to: '/member', label: t('nav.overview'), icon: '🏠', end: true },
    { to: '/member/requests', label: t('nav.myRequests'), icon: '📋' },
    { to: '/member/equipment', label: t('nav.equipment'), icon: '🔬' },
    { to: '/member/bookings', label: t('nav.myBookings'), icon: '📅' },
    { to: '/member/consumables', label: t('nav.consumables'), icon: '🧪' },
    { to: '/member/faults', label: t('nav.reportFault'), icon: '⚠️' },
    { to: '/member/announcements', label: t('nav.announcements'), icon: '📢' },
    { to: '/member/research-pulse', label: t('nav.researchPulse'), icon: '🧬' },
    { to: '/member/lab-feed', label: t('nav.labFeed'), icon: '📡' },
    { to: '/member/profile', label: t('nav.profile'), icon: '👤' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const SidebarContent = () => (
    <>
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <NbslLogo size={28} color="#1d4ed8" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 text-sm leading-none">NBSL</h1>
            <p className="text-xs text-gray-400 mt-0.5">{t('portal.member')}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary-50 text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100 mt-auto space-y-3">
        <LangToggleButton className="w-full justify-center" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-gray-600">{user?.fullName?.[0] ?? '?'}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">{user?.fullName}</p>
            <p className="text-xs text-gray-400">Member</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded hover:bg-red-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          {t('nav.signOut')}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col fixed inset-y-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white flex flex-col animate-slide-up shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 md:ml-56 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <span className="font-semibold text-gray-900 text-sm">NBSL</span>
        </div>

        <div className="flex-1 p-5 md:p-8 animate-fade-in">
          <Outlet />
        </div>
      </main>

      <HelpButton role="member" />
    </div>
  );
}
