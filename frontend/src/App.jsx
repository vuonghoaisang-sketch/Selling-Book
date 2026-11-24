import { useEffect, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import BookList from './pages/BookList'
import BookDetail from './pages/BookDetail'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import { getCurrentAdmin } from './api/auth'

function App() {
  // currentPage nhớ trang đang xem: 'home', 'books', 'detail' hoặc 'admin'
  const [currentPage, setCurrentPage] = useState('home')
  // selectedBookId nhớ id cuốn sách đang xem chi tiết
  const [selectedBookId, setSelectedBookId] = useState(null)
  // admin lưu thông tin Admin đang đăng nhập ({ id, username }) hoặc null
  const [admin, setAdmin] = useState(null)
  // authLoading tránh hiện thoáng qua trang đăng nhập khi đang kiểm tra session
  const [authLoading, setAuthLoading] = useState(true)

  // Khi ứng dụng tải lên: kiểm tra phiên đăng nhập Admin hiện tại
  useEffect(() => {
    let ignore = false

    getCurrentAdmin()
      .then((data) => {
        if (!ignore) setAdmin(data)
      })
      .catch(() => {
        if (!ignore) setAdmin(null)
      })
      .finally(() => {
        if (!ignore) setAuthLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  // Khi chọn một cuốn sách: lưu id rồi chuyển sang trang chi tiết
  function handleSelectBook(bookId) {
    setSelectedBookId(bookId)
    setCurrentPage('detail')
  }

  function handleLoginSuccess(loggedInAdmin) {
    setAdmin(loggedInAdmin)
  }

  function handleLogout() {
    setAdmin(null)
  }

  function renderAdminPage() {
    if (authLoading) {
      return (
        <div className="container page">
          <p className="status-message">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      )
    }

    if (admin) {
      return <AdminDashboard admin={admin} onLogout={handleLogout} />
    }

    return <AdminLogin onLoginSuccess={handleLoginSuccess} />
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
        {currentPage === 'admin' && renderAdminPage()}
      </main>
      <Footer />
    </div>
  )
}

export default App
