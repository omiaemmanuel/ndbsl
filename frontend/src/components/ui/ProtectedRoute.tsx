import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  role: 'member' | 'professor' | 'admin';
  children: React.ReactNode;
}

const ROLE_DASHBOARDS: Record<string, string> = {
  member: '/member',
  professor: '/professor',
  admin: '/admin',
  super_admin: '/admin',
};

export function ProtectedRoute({ role, children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user.role === 'super_admin' ? 'admin' : user.role;
  if (userRole !== role) {
    return <Navigate to={ROLE_DASHBOARDS[user.role] || '/login'} replace />;
  }

  return <>{children}</>;
}
