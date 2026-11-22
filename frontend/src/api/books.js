// Các hàm gọi API sách của backend Flask
// Mặc định dùng đường dẫn /api/... và Vite sẽ chuyển sang Flask (xem vite.config.js)
// Nếu cần đổi địa chỉ backend, đặt biến VITE_API_URL
const API_URL = import.meta.env.VITE_API_URL || ''

// Lấy danh sách toàn bộ sách
export async function getBooks() {
  const response = await fetch(`${API_URL}/api/books`)
  if (!response.ok) {
    throw new Error('Không thể tải danh sách sách')
  }
  return response.json()
}

// Lấy chi tiết một cuốn sách theo id
// Trả về null nếu không tìm thấy sách (HTTP 404)
export async function getBookById(id) {
  const response = await fetch(`${API_URL}/api/books/${id}`)
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error('Không thể tải thông tin sách')
  }
  return response.json()
}