import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AppLayout } from './components/Layout'
import { AchievementsPage } from './pages/AchievementsPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { HomePage } from './pages/HomePage'
import { JobsPage } from './pages/JobsPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { SettingsPage } from './pages/SettingsPage'
import { PeoplePage } from './pages/PeoplePage'
import { ProfilePage } from './pages/ProfilePage'
import { RatingPage } from './pages/RatingPage'
import { PublicProfilePage } from './pages/PublicProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { AdminRoute } from './routes/AdminRoute'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { trackEvent } from './lib/analytics'

const CalendarPage = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })))
const ShowcasePage = lazy(() => import('./pages/ShowcasePage').then((m) => ({ default: m.ShowcasePage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))
const CommunitiesPage = lazy(() => import('./pages/CommunitiesPage').then((m) => ({ default: m.CommunitiesPage })))

function RouteFallback() {
  return <div className="ushqn-card h-28 animate-pulse" />
}

function PageViewTracker() {
  const location = useLocation()

  useEffect(() => {
    trackEvent('page_view', { path: location.pathname })
  }, [location.pathname])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <PageViewTracker />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected app routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/rating" element={<RatingPage />} />
            <Route path="/u/:id" element={<PublicProfilePage />} />
            <Route path="/achievements" element={<AchievementsPage />} />
            <Route
              path="/showcase"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <ShowcasePage />
                </Suspense>
              }
            />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route
              path="/communities"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <CommunitiesPage />
                </Suspense>
              }
            />
            <Route
              path="/chat"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <ChatPage />
                </Suspense>
              }
            />
            <Route
              path="/chat/:conversationId"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <ChatPage />
                </Suspense>
              }
            />
            <Route
              path="/calendar"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <CalendarPage />
                </Suspense>
              }
            />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <AdminPage />
                  </Suspense>
                </AdminRoute>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
