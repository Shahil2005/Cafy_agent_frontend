import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute({ user }: { user: any }) {
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Double check verification on protected routes
  // Use a strict check for emailVerified. If it's expressly false, or if it's 
  // not true for a password user, redirect to root.
  const isVerified = user.emailVerified === true;

  if (!isVerified) {
    return <Navigate to="/" replace />; // App.tsx will handle the verification screen
  }

  return <Outlet />; // allows protected routes to render
}
