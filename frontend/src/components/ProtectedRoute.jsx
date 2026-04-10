import { Navigate, useLocation } from 'react-router-dom';
import { useAuthSession } from '../utils/auth';

function ProtectedRoute({ children, allowedRoles }) {
  const session = useAuthSession();
  const location = useLocation();

  if (!session?.token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(session.user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;