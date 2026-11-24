// Các hàm gọi API xác thực Admin của backend Flask
// Dùng credentials: 'include' để trình duyệt gửi và nhận Flask Session cookie
const API_URL = import.meta.env.VITE_API_URL || ''

// Đăng nhập Admin bằng username và password
export async function loginAdmin(username, password) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.')
    }
    throw new Error(data.error || 'Đăng nhập thất bại. Vui lòng thử lại.')
  }

  return data
}

// Kiểm tra phiên đăng nhập hiện tại từ Flask Session
// Trả về null nếu chưa đăng nhập hoặc phiên đã hết hạn (HTTP 401)
export async function getCurrentAdmin() {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
  })

  if (response.status === 401) {
    return null
  }

  if (!response.ok) {
    throw new Error('Không thể kiểm tra phiên đăng nhập.')
  }

  return response.json()
}

// Đăng xuất Admin và xóa Flask Session trên server
export async function logoutAdmin() {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Đăng xuất thất bại. Vui lòng thử lại.')
  }

  return response.json()
}
