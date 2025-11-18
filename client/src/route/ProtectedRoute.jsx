import { Navigate } from "react-router-dom";
import { UserContext } from "@/context/UserContext";
import { useContext } from "react";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useContext(UserContext);

  if (!user) return <Navigate to="/login" replace />;

  // check user role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "TEACHER") {
      return <Navigate to="/teacher-courses" replace />;
    }

    if (user.role === "STUDENT") {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
