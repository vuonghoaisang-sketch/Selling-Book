// Thẻ hiển thị thông tin một cuốn sách
// book: object chứa id, title, author, price (do component cha truyền vào)
// onSelect: hàm gọi khi bấm "Xem chi tiết". Nếu không truyền thì không hiện nút
function BookCard({ book, onSelect }) {
  return (
    <div className="book-card">
      <div className="book-cover">Ảnh bìa</div>
      <h3 className="book-title">{book.title}</h3>
      <p className="book-author">Tác giả: {book.author}</p>
      <p className="book-price">{book.price.toLocaleString('vi-VN')}đ</p>
      {onSelect && (
        <button className="button button-small" onClick={onSelect}>
          Xem chi tiết
        </button>
      )}
    </div>
  )
}

export default BookCard