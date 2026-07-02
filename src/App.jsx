import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import TopPage from './pages/TopPage'
import PetListPage from './pages/PetListPage'
import PetSettingsPage from './pages/PetSettingsPage'
import MedicineSettingsPage from './pages/MedicineSettingsPage'
import MedicationStatusPage from './pages/MedicationStatusPage'

// 画面遷移時に常にページ最上部から表示する
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// 未ログイン時はログイン画面にリダイレクトするラッパー
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">読み込み中...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

// ログイン済みならトップへリダイレクト
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">読み込み中...</div>
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><TopPage /></ProtectedRoute>} />
          <Route path="/pets" element={<ProtectedRoute><PetListPage /></ProtectedRoute>} />
          <Route path="/pets/new" element={<ProtectedRoute><PetSettingsPage /></ProtectedRoute>} />
          <Route path="/pets/:petId/edit" element={<ProtectedRoute><PetSettingsPage /></ProtectedRoute>} />
          <Route path="/pets/:petId/medicines/new" element={<ProtectedRoute><MedicineSettingsPage /></ProtectedRoute>} />
          <Route path="/pets/:petId/medicines/:medicineId/edit" element={<ProtectedRoute><MedicineSettingsPage /></ProtectedRoute>} />
          <Route path="/medication-status" element={<ProtectedRoute><MedicationStatusPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
