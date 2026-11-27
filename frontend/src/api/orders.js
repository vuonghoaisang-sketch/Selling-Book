// Các hàm gửi đơn hàng
// API contract thống nhất với Backend:
//   POST /api/orders
//   Request:  { customer_name, phone, shipping_address, items: [{ book_id, quantity }] }
//   201: { message, order: { id, total_amount, items } }
//   400 dữ liệu không hợp lệ, 404 không tìm thấy sách, 409 không đủ tồn kho
//   Lỗi:     { message }
// Frontend KHÔNG gửi giá tiền. Backend tự lấy giá từ database và tính tổng tiền.
import { toOrderItems } from "../utils/cart.js";

const API_URL = import.meta.env?.VITE_API_URL || "";

// Lỗi khi đặt hàng, có kèm mã HTTP (status) nếu có
export class OrderError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "OrderError";
    this.status = status;
  }
}

// Tạo dữ liệu gửi lên Backend từ form và giỏ hàng
export function buildOrderPayload(form, cart) {
  return {
    customer_name: form.customer_name.trim(),
    phone: form.phone.trim(),
    shipping_address: form.shipping_address.trim(),
    items: toOrderItems(cart),
  };
}

// Chọn thông báo lỗi: ưu tiên nội dung Backend trả về
function getErrorMessage(status, data) {
  const serverMessage = data && (data.message || data.error);
  if (serverMessage) return serverMessage;

  if (status === 400) return "Dữ liệu đặt hàng không hợp lệ.";
  if (status === 404) return "Sách không tồn tại.";
  if (status === 409)
    return "Số lượng tồn kho không đủ hoặc không thể đặt hàng.";
  if (status >= 500) return "Lỗi máy chủ. Vui lòng thử lại sau.";
  return "Không thể đặt hàng. Vui lòng thử lại sau.";
}

// Gọi API đặt hàng THẬT (POST /api/orders)
// Thành công trả về dữ liệu Backend (message, order). Thất bại ném OrderError
export async function createOrder(payload) {
  let response;
  try {
    response = await fetch(`${API_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new OrderError(
      "Không thể kết nối Backend. Vui lòng kiểm tra kết nối và thử lại.",
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.ok) {
    if (!data || typeof data !== "object" || !data.order) {
      throw new OrderError(
        "Phản hồi từ máy chủ không hợp lệ.",
        response.status,
      );
    }
    return data;
  }
  throw new OrderError(getErrorMessage(response.status, data), response.status);
}

// ===== CHỨC NĂNG MÔ PHỎNG =====
// Hàm này KHÔNG gọi Backend và KHÔNG lưu đơn hàng ở bất kỳ đâu.
// Chỉ dùng để kiểm tra giao diện và luồng xử lý khi Backend chưa có API đặt hàng.
// Muốn thử trường hợp thất bại: nhập địa chỉ giao hàng chứa chữ TEST-LOI.
export async function createOrderMock(payload, delayMs = 800) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (payload.shipping_address.includes("TEST-LOI")) {
    throw new OrderError("Mô phỏng: đặt hàng thất bại.");
  }

  // Cố ý không có mã đơn hàng hay tổng tiền, vì chưa có đơn hàng thật nào được tạo
  return { mock: true };
}

// ===== ĐIỂM CHUYỂN ĐỔI =====
// Trang Checkout chỉ dùng submitOrder. Đã chuyển sang gọi API thật POST /api/orders.
export const submitOrder = createOrder;

// Cho giao diện biết đang dùng bản mô phỏng để hiện ghi chú cho người dùng
export const isMockOrder = submitOrder === createOrderMock;
