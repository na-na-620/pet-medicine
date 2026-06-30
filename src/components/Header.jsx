import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// 全画面共通ヘッダー（三マークメニュー + タイトル + ログアウト）
export default function Header({ title }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()

  const handleNav = (path) => {
    setMenuOpen(false)
    navigate(path)
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { label: '🏠 トップ（本日の投薬）', path: '/' },
    { label: '🐾 ペット一覧', path: '/pets' },
  ]

  return (
    <>
      {/* ヘッダー本体 */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* 三マークメニューボタン */}
          <button
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            onClick={() => setMenuOpen(true)}
            aria-label="メニューを開く"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* タイトル */}
          <h1 className="text-lg font-bold text-purple-700">{title ?? 'ペット投薬管理'}</h1>

          {/* ログアウトボタン */}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-500 px-2 py-1 rounded"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* オーバーレイ（メニュー外クリックで閉じる） */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* スライドインドロワーメニュー */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white z-50 shadow-xl transform transition-transform duration-250 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b">
          <p className="text-sm font-bold text-purple-700">🐾 ペット投薬管理</p>
        </div>
        <nav className="p-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full text-sm text-red-500 hover:bg-red-50 py-2 rounded-lg"
          >
            ログアウト
          </button>
        </div>
      </div>
    </>
  )
}
