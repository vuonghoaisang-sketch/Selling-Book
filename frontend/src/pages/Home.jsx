import BookCard from '../components/BookCard'
import books from '../data/books'

// Trang chủ: giới thiệu cửa hàng và hiển thị sách nổi bật
// onNavigate: hàm do App truyền xuống để chuyển trang
function Home({ onNavigate }) {
  const featuredBooks = books.filter((book) => book.featured)

  return (
    <div className="container page">
      <h2>Chào mừng đến với cửa hàng Bán Sách</h2>
      <p>
        Cửa hàng chuyên cung cấp các đầu sách văn học Việt Nam với giá hợp lý.
      </p>

      <h3>Sách nổi bật</h3>
      <div className="book-grid">
        {featuredBooks.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>

      <button className="button" onClick={() => onNavigate('books')}>
        Xem tất cả sách
      </button>
    </div>
  )
}
    
export default Home