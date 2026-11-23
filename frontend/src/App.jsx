import { useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import BookList from './pages/BookList'
import BookDetail from './pages/BookDetail'

function App() {
  // currentPage nhớ trang đang xem: 'home', 'books' hoặc 'detail'
  const [currentPage, setCurrentPage] = useState('home')
  // selectedBookId nhớ id cuốn sách đang xem chi tiết
  const [selectedBookId, setSelectedBookId] = useState(null)

  // Khi chọn một cuốn sách: lưu id rồi chuyển sang trang chi tiết
  function handleSelectBook(bookId) {
    setSelectedBookId(bookId)
    setCurrentPage('detail')
  }

  return (
    <div className="app">
      <Header
        currentPage={currentPage === 'detail' ? 'books' : currentPage}
        onNavigate={setCurrentPage}
      />
      <main className="main">
        {currentPage === 'home' && <Home onNavigate={setCurrentPage} />}
        {currentPage === 'books' && <BookList onSelectBook={handleSelectBook} />}
        {currentPage === 'detail' && (
          <BookDetail
            bookId={selectedBookId}
            onBack={() => setCurrentPage('books')}
          />
        )}
      </main>
      <Footer />
    </div>
  )
}

export default App