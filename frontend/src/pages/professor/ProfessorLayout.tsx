import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { NbslLogo } from '../../components/ui/NbslLogo';
import { useLanguage, LangToggleButton } from '../../contexts/LanguageContext';
import { HelpButton } from '../../components/ui/HelpPanel';

export default function ProfessorLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const NAV_ITEMS = [
    { to: '/professor/requests', label: t('nav.requestReview') },
    { to: '/professor/procurement', label: t('nav.procurementReview') },
    { to: '/professor/expenditure', label: t('nav.expenditure') },
    { to: '/professor/research-pulse', label: t('nav.researchPulse') },
    { to: '/professor/lab-feed', label: t('nav.labFeed') },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <NbslLogo size={28} color="#1d4ed8" className="shrink-0" />
            <div>
              <h1 className="font-bold text-primary-900 text-sm leading-none">NBSL</h1>
              <p className="text-xs text-gray-400 mt-0.5">{t('portal.professor')}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 shrink-0 space-y-3">
          <LangToggleButton className="w-full justify-center" />
          <p className="text-xs text-gray-500 truncate">{user?.fullName}</p>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-gray-500 hover:text-red-600 transition-colors"
          >
            {t('nav.signOut')}
          </button>
        </div>
      </aside>

      {/* Main content offset by sidebar width */}
      <main className="flex-1 ml-56 overflow-auto p-8">
        <Outlet />
      </main>

      <HelpButton role="professor" />
    </div>
  );
}
