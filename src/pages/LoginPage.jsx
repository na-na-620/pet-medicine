import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ログイン・会員登録を切り替えられる認証画面
export default function LoginPage() {
  const [mode, setMode] = useState('login')   // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

    if (!email.trim()) { setError('メールアドレスを入力してください'); setLoading(false); return }
    if (!password) { setError('パスワードを入力してください'); setLoading(false); return }
    if (mode === 'register' && password.length < 6) { setError('パスワードは6文字以上で入力してください'); setLoading(false); return }

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
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">パスワード</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  style={{ paddingRight: '2.5rem' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? '6文字以上' : 'パスワードを入力'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
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
