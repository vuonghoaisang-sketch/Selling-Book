import BookCard from '../components/BookCard'
import books from '../data/books'

// Trang danh sách: hiển thị toàn bộ sách mẫu
function BookList() {
  return (
    <div className="container page">
      <h2>Danh sách sách</h2>
      <div className="book-grid">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </div>
  )
}

export default BookList