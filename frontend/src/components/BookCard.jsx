// Thẻ hiển thị thông tin một cuốn sách
// book: object chứa id, title, author, price (do component cha truyền vào)
function BookCard({ book }) {
  return (
    <div className="book-card">
      <div className="book-cover">Ảnh bìa</div>
      <h3 className="book-title">{book.title}</h3>
      <p className="book-author">Tác giả: {book.author}</p>
      <p className="book-price">{book.price.toLocaleString('vi-VN')}đ</p>
    </div>
  )
}

export default BookCard