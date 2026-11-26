// Các hàm gửi đơn hàng
// API contract thống nhất với Backend:
//   POST /api/orders
//   Request:  { customer_name, phone, shipping_address, items: [{ book_id, quantity }] }
//   201: { message, order: { id, total_amount, items } }
//   400 dữ liệu không hợp lệ, 404 không tìm thấy sách, 409 không đủ tồn kho
//   Lỗi:     { message }
// Frontend KHÔNG gửi giá tiền. Backend tự lấy giá từ database và tính tổng tiền.
import { toOrderItems } from '../utils/cart.js'

const API_URL = import.meta.env?.VITE_API_URL || ''

// Lỗi khi đặt hàng, có kèm mã HTTP (status) nếu có
export class OrderError extends Error {
  constructor(message, status = null) {
    super(message)
    this.name = 'OrderError'
    this.status = status
  }
}

// Tạo dữ liệu gửi lên Backend từ form và giỏ hàng
export function buildOrderPayload(form, cart) {
  return {
    customer_name: form.customer_name.trim(),
    phone: form.phone.trim(),
    shipping_address: form.shipping_address.trim(),
    items: toOrderItems(cart),
  }
}

// Chọn thông báo lỗi: ưu tiên nội dung Backend trả về
function getErrorMessage(status, data) {
  const serverMessage = data && (data.message || data.error)
  if (serverMessage) return serverMessage

  if (status === 400) return 'Thông tin đơn hàng không hợp lệ.'
  if (status === 404) return 'Có sách trong giỏ hàng không còn tồn tại.'
  if (status === 409) return 'Một số sách không đủ số lượng trong kho.'
  return 'Không thể đặt hàng. Vui lòng thử lại sau.'
}

// Gọi API đặt hàng THẬT (dùng khi Backend BS-15 hoàn thành)
// Thành công trả về dữ liệu Backend (message, order). Thất bại ném OrderError
export async function createOrder(payload) {
  const response = await fetch(`${API_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  let data 
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (response.ok) {
    return data
  }
  throw new OrderError(getErrorMessage(response.status, data), response.status)
}

// ===== CHỨC NĂNG MÔ PHỎNG =====
// Hàm này KHÔNG gọi Backend và KHÔNG lưu đơn hàng ở bất kỳ đâu.
// Chỉ dùng để kiểm tra giao diện và luồng xử lý khi Backend chưa có API đặt hàng.
// Muốn thử trường hợp thất bại: nhập địa chỉ giao hàng chứa chữ TEST-LOI.
export async function createOrderMock(payload, delayMs = 800) {
  await new Promise((resolve) => setTimeout(resolve, delayMs))

  if (payload.shipping_address.includes('TEST-LOI')) {
    throw new OrderError('Mô phỏng: đặt hàng thất bại.')
  }

  // Cố ý không có mã đơn hàng hay tổng tiền, vì chưa có đơn hàng thật nào được tạo
  return { mock: true }
}

// ===== ĐIỂM CHUYỂN ĐỔI =====
// Trang Checkout chỉ dùng submitOrder. Khi Backend hoàn thành,
// đổi createOrderMock thành createOrder ở dòng dưới là xong.
export const submitOrder = createOrderMock

// Cho giao diện biết đang dùng bản mô phỏng để hiện ghi chú cho người dùng
export const isMockOrder = submitOrder === createOrderMock