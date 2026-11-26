// Thẻ hiển thị thông tin một cuốn sách
// book: object chứa id, title, author, price, stock (do component cha truyền vào)
// onSelect: hàm gọi khi bấm "Xem chi tiết". Nếu không truyền thì không hiện nút
// onAddToCart: hàm gọi khi bấm "Thêm vào giỏ". Nếu không truyền thì không hiện nút
function BookCard({ book, onSelect, onAddToCart }) {
  const outOfStock = book.stock === 0

  return (
    <div className="book-card">
      <div className="book-cover">Ảnh bìa</div>
      <h3 className="book-title">{book.title}</h3>
      <p className="book-author">Tác giả: {book.author}</p>
      <p className="book-price">{book.price.toLocaleString('vi-VN')}đ</p>
      {(onSelect || onAddToCart) && (
        <div className="book-card-actions">
          {onSelect && (
            <button className="button button-small" onClick={onSelect}>
              Xem chi tiết
            </button>
          )}
          {onAddToCart && (
            <button
              className="button button-small"
              onClick={onAddToCart}
              disabled={outOfStock}
            >
              {outOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default BookCard