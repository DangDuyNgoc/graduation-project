import { Navigate } from "react-router-dom";
import { UserContext } from "@/context/UserContext";
import { useContext } from "react";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useContext(UserContext);

  if (!user) return <Navigate to="/login" />;

  // check user role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
