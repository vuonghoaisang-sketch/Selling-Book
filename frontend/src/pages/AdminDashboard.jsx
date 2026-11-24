import { useState } from 'react'
import { logoutAdmin } from '../api/auth'

// Trang quản trị cơ bản (placeholder) chỉ hiển thị khi Admin đã đăng nhập
// admin: thông tin Admin hiện tại ({ id, username })
// onLogout: hàm do App truyền xuống để xóa trạng thái đăng nhập ở frontend
function AdminDashboard({ admin, onLogout }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogout() {
    setError('')
    setLoading(true)
    try {
      await logoutAdmin()
      onLogout()
    } catch {
      setError('Không thể đăng xuất lúc này. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container page">
      <div className="admin-card">
        <h2>Khu vực quản trị</h2>
        <p className="admin-welcome">
          Chào mừng trở lại, <strong>{admin.username}</strong>!
        </p>
        <p className="admin-note">
          Bạn đã đăng nhập thành công vào hệ thống quản trị cửa hàng Bán Sách.
          Các chức năng quản lý sách và đơn hàng sẽ được bổ sung ở các giai đoạn tiếp theo.
        </p>

        {error && <p className="form-error">{error}</p>}

        <button
          type="button"
          className="button button-danger"
          onClick={handleLogout}
          disabled={loading}
        >
          {loading ? 'Đang đăng xuất...' : 'Đăng xuất'}
        </button>
      </div>
    </div>
  )
}

export default AdminDashboard
