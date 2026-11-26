import { useEffect, useState } from 'react'
import { getBookById } from '../api/books'

// Trang chi tiết một cuốn sách
// bookId: id của sách cần xem
// onBack: hàm do App truyền xuống để quay lại danh sách
// onAddToCart: hàm do App truyền xuống để thêm sách vào giỏ hàng
function BookDetail({ bookId, onBack, onAddToCart }) {
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Gọi API lấy chi tiết sách khi trang hiện ra
  useEffect(() => {
    let ignore = false

    getBookById(bookId)
      .then((data) => {
        // data là null khi API trả về 404 (không tìm thấy sách)
        if (!ignore) setBook(data)
      })
      .catch(() => {
        if (!ignore) setError('Không thể tải thông tin sách. Vui lòng thử lại sau.')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [bookId])

  // Chọn nội dung hiển thị theo trạng thái
  let content
  if (loading) {
    content = <p className="status-message">Đang tải thông tin sách...</p>
  } else if (error) {
    content = <p className="status-message error-message">{error}</p>
  } else if (book === null) {
    content = <p className="status-message">Không tìm thấy sách này.</p>
  } else {
    content = (
      <div className="book-detail">
        <div className="book-cover">Ảnh bìa</div>
        <div className="book-info">
          <h2>{book.title}</h2>
          <p>Tác giả: {book.author}</p>
          <p className="book-price">{book.price.toLocaleString('vi-VN')}đ</p>
          <p>{book.stock > 0 ? `Còn ${book.stock} cuốn` : 'Hết hàng'}</p>
          <p>{book.description || 'Chưa có mô tả cho cuốn sách này.'}</p>
          {onAddToCart && (
            <button
              className="button"
              onClick={() => onAddToCart(book)}
              disabled={book.stock === 0}
            >
              {book.stock === 0 ? 'Hết hàng' : 'Thêm vào giỏ'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <button className="button" onClick={onBack}>
        Quay lại danh sách
      </button>
      {content}
    </div>
  )
}

export default BookDetail