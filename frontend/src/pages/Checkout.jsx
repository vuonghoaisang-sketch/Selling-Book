import { useState } from 'react'
import { buildOrderPayload, isMockOrder, OrderError, submitOrder } from '../api/orders'
import {
  formatPrice,
  getItemSubtotal,
  getTotalPrice,
  getTotalQuantity,
} from '../utils/cart'

const EMPTY_FORM = { customer_name: '', phone: '', shipping_address: '' }

// Bỏ khoảng trắng, dấu chấm và dấu gạch ngang trong số điện thoại
function normalizePhone(phone) {
  return phone.replace(/[\s.-]/g, '')
}

// Kiểm tra form, trả về object lỗi theo từng trường (rỗng nếu hợp lệ)
function validateForm(form) {
  const errors = {}

  if (form.customer_name.trim() === '') {
    errors.customer_name = 'Vui lòng nhập họ và tên.'
  }

  const phone = normalizePhone(form.phone)
  if (phone === '') {
    errors.phone = 'Vui lòng nhập số điện thoại.'
  } else if (!/^(0|\+84)\d{9}$/.test(phone)) {
    errors.phone = 'Số điện thoại không hợp lệ (ví dụ: 0901234567).'
  }

  if (form.shipping_address.trim() === '') {
    errors.shipping_address = 'Vui lòng nhập địa chỉ giao hàng.'
  }

  return errors
}

// Trang đặt hàng
// cart: danh sách sách trong giỏ
// onClearCart: hàm do App truyền xuống, chỉ gọi SAU KHI đặt hàng thành công
// onNavigate: hàm do App truyền xuống để chuyển trang
function Checkout({ cart, onClearCart, onNavigate }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  // status: 'idle' (chưa gửi), 'submitting' (đang xử lý), 'success', 'error'
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [result, setResult] = useState(null)

  const submitting = status === 'submitting'

  function handleChange(event) {
    const { name, value } = event.target
    setForm({ ...form, [name]: value })
    // Người dùng đang sửa ô nào thì xóa lỗi của ô đó
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' })
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const validationErrors = validateForm(form)
    setErrors(validationErrors)
    // Thông tin không hợp lệ thì không gửi đơn
    if (Object.keys(validationErrors).length > 0) return

    setStatus('submitting')
    setErrorMessage('')

    try {
      const payload = buildOrderPayload(
        { ...form, phone: normalizePhone(form.phone) },
        cart,
      )
      const data = await submitOrder(payload)
      // Chỉ xóa giỏ hàng khi gửi đơn thành công
      onClearCart()
      setResult(data)
      setStatus('success')
    } catch (error) {
      // Thất bại thì giữ nguyên giỏ hàng để người dùng thử lại
      setErrorMessage(
        error instanceof OrderError
          ? error.message
          : 'Không thể kết nối đến hệ thống. Vui lòng thử lại sau.',
      )
      setStatus('error')
    }
  }

  // Trạng thái thành công (kiểm tra trước, vì lúc này giỏ hàng đã được xóa)
  if (status === 'success') {
    const order = result && result.order

    return (
      <div className="container page">
        {isMockOrder ? (
          <>
            <h2>Hoàn tất mô phỏng đặt hàng</h2>
            <div className="alert alert-success" role="status">
              Đây là chế độ mô phỏng để kiểm tra giao diện. Đơn hàng chưa được gửi
              đến hệ thống và chưa được lưu vào cơ sở dữ liệu.
            </div>
          </>
        ) : (
          <>
            <h2>Đặt hàng thành công</h2>
            <div className="alert alert-success" role="status">
              Cảm ơn bạn đã đặt hàng.
              {order && order.id && <> Mã đơn hàng: <strong>{order.id}</strong>.</>}
              {order && Number.isInteger(order.total_amount) && (
                <> Tổng tiền: <strong>{formatPrice(order.total_amount)}</strong>.</>
              )}
            </div>
          </>
        )}
        <button className="button" onClick={() => onNavigate('books')}>
          Tiếp tục mua sắm
        </button>
      </div>
    )
  }

  // Giỏ hàng trống thì không có gì để đặt
  if (cart.length === 0) {
    return (
      <div className="container page">
        <h2>Đặt hàng</h2>
        <p className="status-message">Giỏ hàng trống, chưa có sách để đặt.</p>
        <button className="button" onClick={() => onNavigate('books')}>
          Quay lại mua sắm
        </button>
      </div>
    )
  }

  return (
    <div className="container page">
      <h2>Đặt hàng</h2>

      {isMockOrder && (
        <p className="checkout-mock-note">
          Chế độ mô phỏng: hệ thống chưa nhận đơn hàng thật. Đơn hàng sẽ không được lưu.
        </p>
      )}

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit} noValidate>
          <h3>Thông tin người nhận</h3>

          <div className="form-group">
            <label htmlFor="customer_name">
              Họ và tên <span className="required-mark">*</span>
            </label>
            <input
              id="customer_name"
              name="customer_name"
              type="text"
              maxLength={150}
              value={form.customer_name}
              onChange={handleChange}
              disabled={submitting}
              aria-invalid={Boolean(errors.customer_name)}
            />
            {errors.customer_name && (
              <p className="form-error">{errors.customer_name}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="phone">
              Số điện thoại <span className="required-mark">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              maxLength={20}
              value={form.phone}
              onChange={handleChange}
              disabled={submitting}
              aria-invalid={Boolean(errors.phone)}
            />
            {errors.phone && <p className="form-error">{errors.phone}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="shipping_address">
              Địa chỉ giao hàng <span className="required-mark">*</span>
            </label>
            <textarea
              id="shipping_address"
              name="shipping_address"
              rows={3}
              value={form.shipping_address}
              onChange={handleChange}
              disabled={submitting}
              aria-invalid={Boolean(errors.shipping_address)}
            />
            {errors.shipping_address && (
              <p className="form-error">{errors.shipping_address}</p>
            )}
          </div>

          {status === 'error' && (
            <div className="alert alert-error" role="alert">
              {errorMessage}
            </div>
          )}

          <div className="checkout-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => onNavigate('cart')}
              disabled={submitting}
            >
              Quay lại giỏ hàng
            </button>
            <button type="submit" className="button" disabled={submitting}>
              {submitting ? 'Đang xử lý...' : 'Xác nhận đặt hàng'}
            </button>
          </div>
        </form>

        <div className="checkout-summary">
          <h3>Tóm tắt đơn hàng</h3>
          <ul className="checkout-items">
            {cart.map((item) => (
              <li key={item.book_id} className="checkout-item">
                <div>
                  <p className="checkout-item-title">{item.title}</p>
                  <p className="checkout-item-detail">
                    {formatPrice(item.price)} x {item.quantity}
                  </p>
                </div>
                <p className="checkout-item-subtotal">
                  {formatPrice(getItemSubtotal(item))}
                </p>
              </li>
            ))}
          </ul>
          <p>
            Tổng số lượng: <strong>{getTotalQuantity(cart)}</strong> cuốn
          </p>
          <p className="cart-total">
            Tổng tiền dự kiến: <strong>{formatPrice(getTotalPrice(cart))}</strong>
          </p>
          <p className="cart-note">
            Tổng tiền chỉ để tham khảo. Giá chính thức sẽ do hệ thống tính lại khi đặt hàng.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Checkout