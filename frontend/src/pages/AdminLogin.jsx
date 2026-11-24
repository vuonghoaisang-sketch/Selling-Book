import { useState } from 'react'
import { loginAdmin } from '../api/auth'

// Trang đăng nhập dành cho quản trị viên (Admin)
// onLoginSuccess: hàm do App truyền xuống, gọi khi đăng nhập thành công
function AdminLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const trimmedUsername = username.trim()
    if (!trimmedUsername || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.')
      return
    }

    setLoading(true)
    try {
      const data = await loginAdmin(trimmedUsername, password)
      setPassword('')
      onLoginSuccess(data.admin)
    } catch (err) {
      if (err instanceof TypeError) {
        setError('Không thể kết nối tới máy chủ. Vui lòng thử lại sau.')
      } else {
        setError(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container page">
      <div className="auth-card">
        <h2>Đăng nhập quản trị</h2>
        <p className="auth-subtitle">
          Vui lòng đăng nhập bằng tài khoản Admin để truy cập khu vực quản trị.
        </p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="admin-username">Tên đăng nhập</label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              autoComplete="username"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-password">Mật khẩu</label>
            <div className="password-field">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                disabled={loading}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading}
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="button auth-submit" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminLogin
