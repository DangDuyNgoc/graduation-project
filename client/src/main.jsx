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
import ProtectedRoute from "./route/ProtectedRoute";
import TeacherCoursePage from "./pages/dashboard/TeacherCoursePage";
import TeacherAssignmentPage from "./pages/dashboard/TeacherAssignmentPage";
import TeachersSubmissionPage from "./pages/dashboard/TeachersSubmisionPage";
import TeacherSubmissionStudentPage from "./pages/dashboard/TeacherSubmissionStudentPage";
import TeacherEnrolledStudent from "./pages/dashboard/TeacherEnrolledStudent";
import TeacherEnrolStudent from "./pages/dashboard/TeacherEnrolStudent";
import ConversationsPage from "./pages/dashboard/ConversationsPage";

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
        path: "/conversations",
        element: <ConversationsPage />,
      },
      {
        path: "/plagiarism-report/:id",
        element: <PlagiarismReport />,
      },
      {
        path: "/teacher-courses",
        element: (
          <ProtectedRoute allowedRoles={["TEACHER"]}>
            <TeacherCoursePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/teacher-assignment/:id",
        element: (
          <ProtectedRoute allowedRoles={["TEACHER"]}>
            <TeacherAssignmentPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/teacher-submissions/:id",
        element: (
          <ProtectedRoute allowedRoles={["TEACHER"]}>
            <TeachersSubmissionPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/teacher-submissions-student/:id",
        element: (
          <ProtectedRoute allowedRoles={["TEACHER"]}>
            <TeacherSubmissionStudentPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/teacher-enrolled-student/:id",
        element: (
          <ProtectedRoute allowedRoles={["TEACHER"]}>
            <TeacherEnrolledStudent />
          </ProtectedRoute>
        ),
      },
      {
        path: "/teacher-enroll-student/:id",
        element: (
          <ProtectedRoute allowedRoles={["TEACHER"]}>
            <TeacherEnrolStudent />
          </ProtectedRoute>
        ),
      },
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
