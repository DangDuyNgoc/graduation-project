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
import ChatBotPage from "./pages/dashboard/ChatBotPage";
import ForgotPassword from "./pages/auth/ForgotPassword";
import VerifyCode from "./pages/auth/VerifyCode";
import ResetPassword from "./pages/auth/ResetPassword";

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
        element: (
          <ProtectedRoute allowedRoles={["STUDENT"]}>
            <AssignmentPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/course/:id",
        element: (
          <ProtectedRoute allowedRoles={["STUDENT"]}>
            <CourseDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "/assignment/:id",
        element: (
          <ProtectedRoute allowedRoles={["STUDENT"]}>
            <AssignmentDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "/my-submissions",
        element: (
          <ProtectedRoute allowedRoles={["STUDENT"]}>
            <SubmissionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/profile",
        element: <ProfilePage />,
      },
      {
        path: "/teachers",
        element: (
          <ProtectedRoute allowedRoles={["STUDENT"]}>
            <TeachersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/conversations",
        element: <ConversationsPage />,
      },
      {
        path: "/plagiarism-report/:id",
        element: (
          <ProtectedRoute allowedRoles={["STUDENT"]}>
            <PlagiarismReport />
          </ProtectedRoute>
        ),
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
      {
        path: "/chatbot-ai",
        element: <ChatBotPage />,
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
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  {
    path: "/verify-code",
    element: <VerifyCode />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
]);

createRoot(document.getElementById("root")).render(
  <UserProvider>
    <StrictMode>
      <RouterProvider router={root} />
    </StrictMode>
  </UserProvider>
);
