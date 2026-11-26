import { useEffect, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import BookList from './pages/BookList'
import BookDetail from './pages/BookDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import { getCurrentAdmin } from './api/auth'
import {
  addToCart,
  changeQuantity,
  getTotalQuantity,
  loadCart,
  removeFromCart,
  saveCart,
} from './utils/cart'

function App() {
  // currentPage nhớ trang đang xem: 'home', 'books', 'detail', 'cart', 'checkout' hoặc 'admin'
  const [currentPage, setCurrentPage] = useState('home')
  // selectedBookId nhớ id cuốn sách đang xem chi tiết
  const [selectedBookId, setSelectedBookId] = useState(null)
  // admin lưu thông tin Admin đang đăng nhập ({ id, username }) hoặc null
  const [admin, setAdmin] = useState(null)
  // authLoading tránh hiện thoáng qua trang đăng nhập khi đang kiểm tra session
  const [authLoading, setAuthLoading] = useState(true)
  // cart là giỏ hàng, đọc từ localStorage khi ứng dụng tải lên
  const [cart, setCart] = useState(loadCart)
  // notice là thông báo ngắn khi thêm sách vào giỏ: { type, text } hoặc null
  const [notice, setNotice] = useState(null)

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

  // Mỗi khi giỏ hàng thay đổi: lưu lại vào localStorage
  useEffect(() => {
    saveCart(cart)
  }, [cart])

  // Thông báo tự tắt sau 3 giây
  useEffect(() => {
    if (!notice) return undefined

    const timer = setTimeout(() => setNotice(null), 3000)
    return () => clearTimeout(timer)
  }, [notice])

  // Khi chọn một cuốn sách: lưu id rồi chuyển sang trang chi tiết
  function handleSelectBook(bookId) {
    setSelectedBookId(bookId)
    setCurrentPage('detail')
  }

  // Thêm một cuốn sách (object lấy từ API) vào giỏ hàng và báo kết quả
  function handleAddToCart(book) {
    const result = addToCart(cart, book)
    setCart(result.cart)

    if (result.status === 'added') {
      setNotice({ type: 'success', text: `Đã thêm "${book.title}" vào giỏ hàng.` })
    } else if (result.status === 'increased') {
      setNotice({ type: 'success', text: `Đã tăng số lượng "${book.title}" trong giỏ hàng.` })
    } else if (result.status === 'max_reached') {
      setNotice({ type: 'error', text: `Đã đạt số lượng tối đa trong kho của "${book.title}".` })
    } else if (result.status === 'out_of_stock') {
      setNotice({ type: 'error', text: `"${book.title}" đã hết hàng.` })
    } else {
      setNotice({ type: 'error', text: 'Không thể thêm sách này vào giỏ hàng.' })
    }
  }

  function handleChangeQuantity(bookId, delta) {
    setCart((current) => changeQuantity(current, bookId, delta))
  }

  function handleRemoveFromCart(bookId) {
    setCart((current) => removeFromCart(current, bookId))
  }

  // Chỉ được gọi sau khi đặt hàng thành công
  function handleClearCart() {
    setCart([])
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

  // Menu nào được tô đậm: trang chi tiết thuộc mục Sách, trang đặt hàng thuộc mục Giỏ hàng
  let menuPage = currentPage
  if (currentPage === 'detail') menuPage = 'books'
  if (currentPage === 'checkout') menuPage = 'cart'

  return (
    <div className="app">
      <Header
        currentPage={menuPage}
        onNavigate={setCurrentPage}
        cartCount={getTotalQuantity(cart)}
      />
      {notice && (
        <div className="cart-notice">
          <div
            className={notice.type === 'success' ? 'alert alert-success' : 'alert alert-error'}
            role="status"
          >
            {notice.text}
          </div>
        </div>
      )}
      <main className="main">
        {currentPage === 'home' && <Home onNavigate={setCurrentPage} />}
        {currentPage === 'books' && (
          <BookList onSelectBook={handleSelectBook} onAddToCart={handleAddToCart} />
        )}
        {currentPage === 'detail' && (
          <BookDetail
            bookId={selectedBookId}
            onBack={() => setCurrentPage('books')}
            onAddToCart={handleAddToCart}
          />
        )}
        {currentPage === 'cart' && (
          <Cart
            cart={cart}
            onChangeQuantity={handleChangeQuantity}
            onRemove={handleRemoveFromCart}
            onNavigate={setCurrentPage}
          />
        )}
        {currentPage === 'checkout' && (
          <Checkout
            cart={cart}
            onClearCart={handleClearCart}
            onNavigate={setCurrentPage}
          />
        )}
        {currentPage === 'admin' && renderAdminPage()}
      </main>
      <Footer />
    </div>
  )
}

export default App