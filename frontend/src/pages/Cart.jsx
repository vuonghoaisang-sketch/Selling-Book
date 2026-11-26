import {
  formatPrice,
  getItemSubtotal,
  getTotalPrice,
  getTotalQuantity,
} from '../utils/cart'

// Trang giỏ hàng
// cart: danh sách sách trong giỏ, mỗi dòng { book_id, title, author, price, stock, quantity }
// onChangeQuantity: hàm do App truyền xuống, nhận (book_id, +1 hoặc -1)
// onRemove: hàm do App truyền xuống để xóa một dòng khỏi giỏ
// onNavigate: hàm do App truyền xuống để chuyển trang
function Cart({ cart, onChangeQuantity, onRemove, onNavigate }) {
  // Giỏ hàng trống
  if (cart.length === 0) {
    return (
      <div className="container page">
        <h2>Giỏ hàng</h2>
        <div className="cart-empty">
          <p className="status-message">Giỏ hàng của bạn đang trống.</p>
          <button className="button" onClick={() => onNavigate('books')}>
            Quay lại mua sắm
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <h2>Giỏ hàng</h2>

      <ul className="cart-list">
        {cart.map((item) => {
          // Đã đạt số lượng tối đa theo tồn kho (stock là null khi không biết tồn kho)
          const atMax = item.stock !== null && item.quantity >= item.stock

          return (
            <li key={item.book_id} className="cart-item">
              <div className="cart-item-info">
                <h3 className="cart-item-title">{item.title}</h3>
                <p className="cart-item-author">Tác giả: {item.author}</p>
                <p className="cart-item-price">{formatPrice(item.price)}</p>
                {atMax && (
                  <p className="cart-item-note">
                    Đã đạt số lượng tối đa trong kho ({item.stock} cuốn)
                  </p>
                )}
              </div>

              <div className="cart-quantity">
                <button
                  className="button button-small"
                  aria-label={`Giảm số lượng ${item.title}`}
                  onClick={() => onChangeQuantity(item.book_id, -1)}
                  disabled={item.quantity <= 1}
                >
                  -
                </button>
                <span className="cart-quantity-value">{item.quantity}</span>
                <button
                  className="button button-small"
                  aria-label={`Tăng số lượng ${item.title}`}
                  onClick={() => onChangeQuantity(item.book_id, 1)}
                  disabled={atMax}
                >
                  +
                </button>
              </div>

              <p className="cart-item-subtotal">
                {formatPrice(getItemSubtotal(item))}
              </p>

              <button
                className="button button-danger button-small"
                onClick={() => onRemove(item.book_id)}
              >
                Xóa
              </button>
            </li>
          )
        })}
      </ul>

      <div className="cart-summary">
        <p>
          Tổng số lượng: <strong>{getTotalQuantity(cart)}</strong> cuốn
        </p>
        <p className="cart-total">
          Tổng tiền dự kiến: <strong>{formatPrice(getTotalPrice(cart))}</strong>
        </p>
        <p className="cart-note">
          Tổng tiền chỉ để tham khảo. Giá chính thức sẽ do hệ thống tính lại khi đặt hàng.
        </p>
        <div className="cart-summary-actions">
          <button
            className="button button-secondary"
            onClick={() => onNavigate('books')}
          >
            Tiếp tục mua sắm
          </button>
          <button className="button" onClick={() => onNavigate('checkout')}>
            Đặt hàng
          </button>
        </div>
      </div>
    </div>
  )
}

export default Cart