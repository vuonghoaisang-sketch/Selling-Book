import { useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import BookList from './pages/BookList'

function App() {
  // currentPage nhớ trang đang xem: 'home' hoặc 'books'
  const [currentPage, setCurrentPage] = useState('home')

  return (
    <div className="app">
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="main">
        {currentPage === 'home' && <Home onNavigate={setCurrentPage} />}
        {currentPage === 'books' && <BookList />}
      </main>
      <Footer />
    </div>
  )
}

export default App