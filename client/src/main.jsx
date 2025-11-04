import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";

import "./index.css";
import App from "./App.jsx";
import Login from "./pages/auth/Login.jsx";
import Signup from "./pages/auth/Signup.jsx";
import HomePage from "./pages/dashboard/HomePage";
import UserProvider from "./context/UserProvider";
import CourseDetail from "./components/Courses/CourseDetail";
import AssignmentDetail from "./components/Assignment/AssignmentDetail";
import AssignmentPage from "./pages/dashboard/AssignmentPage";
import SubmissionsPage from "./pages/dashboard/SubmissionsPage";
import ProfilePage from "./pages/dashboard/ProfilePage";
import TeachersPage from "./pages/dashboard/TeachersPage";
import PlagiarismReport from "./components/PlagiarismReport/PlagiarismReport";
// import ProtectedRoute from "./route/ProtectedRoute";

const root = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        path: "/",
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "/dashboard",
        element: <HomePage />,
      },
      {
        path: "/assignments",
        element: <AssignmentPage />,
      },
      {
        path: "/course/:id",
        element: <CourseDetail />,
      },
      {
        path: "/assignment/:id",
        element: <AssignmentDetail />,
      },
      {
        path: "/my-submissions",
        element: <SubmissionsPage />,
      },
      {
        path: "/profile",
        element: <ProfilePage />,
      },
      {
        path: "/teachers",
        element: <TeachersPage />,
      },
      {
        path: "/plagiarism-report/:id",
        element: <PlagiarismReport />,
      },
      // {
      //   path: "/course/:id",
      //   element: (
      //     <ProtectedRoute allowedRoles={["STUDENT", "TEACHER"]}>
      //       <CourseDetail />
      //     </ProtectedRoute>
      //   ),
      // },
    ],
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
]);

createRoot(document.getElementById("root")).render(
  <UserProvider>
    <StrictMode>
      <RouterProvider router={root} />
    </StrictMode>
  </UserProvider>
);
