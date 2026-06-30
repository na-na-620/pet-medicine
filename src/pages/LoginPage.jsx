import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ログイン・会員登録を切り替えられる認証画面
export default function LoginPage() {
  const [mode, setMode] = useState('login')   // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) {
        setError('メールアドレスまたはパスワードが違います')
      } else {
        navigate('/')
      }
    } else {
      const { error } = await signUp(email, password)
      if (error) {
        setError(error.message.includes('already') ? 'このメールアドレスは既に登録されています' : '登録に失敗しました')
      } else {
        setMessage('確認メールを送信しました。メールを確認してからログインしてください。')
        setMode('login')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* ロゴエリア */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐾</div>
          <h1 className="text-2xl font-bold text-purple-700">ペット投薬管理</h1>
          <p className="text-sm text-gray-500 mt-1">大切なペットの投薬スケジュールを管理</p>
        </div>

        {/* フォームカード */}
        <div className="card">
          {/* モード切り替えタブ */}
          <div className="flex gap-2 mb-6 bg-gray-100 rounded-xl p-1">
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-white shadow text-purple-700' : 'text-gray-500'
              }`}
              onClick={() => { setMode('login'); setError(''); setMessage('') }}
            >
              ログイン
            </button>
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'register' ? 'bg-white shadow text-purple-700' : 'text-gray-500'
              }`}
              onClick={() => { setMode('register'); setError(''); setMessage('') }}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="label">メールアドレス</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">パスワード</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? '6文字以上' : 'パスワードを入力'}
                required
                minLength={6}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </div>

            {/* エラーメッセージ */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/* 成功メッセージ */}
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
                {message}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full mt-2"
              disabled={loading}
            >
              {loading ? '処理中...' : mode === 'login' ? 'ログイン' : '会員登録'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          ペットの健康を一緒に守りましょう 🐕🐈
        </p>
      </div>
    </div>
  )
}
