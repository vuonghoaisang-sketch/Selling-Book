// Thanh đầu trang: tên website và menu
// currentPage: tên trang đang xem ('home', 'books' hoặc 'admin')
// onNavigate: hàm do App truyền xuống, gọi khi bấm menu để đổi trang
function Header({ currentPage, onNavigate }) {
  return (
    <header className="header">
      <div className="container header-inner">
        <h1 className="site-name">Bán Sách</h1>
        <nav className="menu">
          <button
            className={currentPage === 'home' ? 'menu-link active' : 'menu-link'}
            onClick={() => onNavigate('home')}
          >
            Trang chủ
          </button>
          <button
            className={currentPage === 'books' ? 'menu-link active' : 'menu-link'}
            onClick={() => onNavigate('books')}
          >
            Sách
          </button>
          <button
            className={currentPage === 'admin' ? 'menu-link active' : 'menu-link'}
            onClick={() => onNavigate('admin')}
          >
            Quản trị
          </button>
        </nav>
      </div>
    </header>
  )
}

export default Header
