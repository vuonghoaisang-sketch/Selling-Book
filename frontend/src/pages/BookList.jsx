import { useEffect, useState } from 'react'
import BookCard from '../components/BookCard'
import { getBooks } from '../api/books'

// Trang danh sách: lấy sách từ API và hiển thị
// onSelectBook: hàm do App truyền xuống, gọi khi người dùng chọn xem chi tiết một cuốn sách
// onAddToCart: hàm do App truyền xuống, gọi khi người dùng thêm sách vào giỏ hàng
function BookList({ onSelectBook, onAddToCart }) {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Chạy một lần khi trang hiện ra: gọi API lấy danh sách sách
  useEffect(() => {
    let ignore = false

    getBooks()
      .then((data) => {
        if (!ignore) setBooks(data)
      })
      .catch(() => {
        if (!ignore) setError('Không thể tải danh sách sách. Vui lòng thử lại sau.')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  // Chọn nội dung hiển thị theo trạng thái
  let content
  if (loading) {
    content = <p className="status-message">Đang tải danh sách sách...</p>
  } else if (error) {
    content = <p className="status-message error-message">{error}</p>
  } else if (books.length === 0) {
    content = <p className="status-message">Chưa có sách nào trong cửa hàng.</p>
  } else {
    content = (
      <div className="book-grid">
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onSelect={() => onSelectBook(book.id)}
            onAddToCart={onAddToCart ? () => onAddToCart(book) : undefined}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="container page">
      <h2>Danh sách sách</h2>
      {content}
    </div>
  )
}

export default BookList