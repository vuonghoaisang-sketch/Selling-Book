import { useEffect, useRef, useState } from 'react'
import { logoutAdmin } from '../api/auth'
import {
  createAdminBook,
  deleteAdminBook,
  getAdminBooks,
  updateAdminBook,
} from '../api/adminBooks'

const MAX_INT = 2147483647

const EMPTY_FORM = {
  title: '',
  author: '',
  description: '',
  price: '',
  stock: '',
}

function formatPrice(price) {
  return `${Number(price).toLocaleString('vi-VN')}đ`
}

// Kiểm tra dữ liệu form trước khi gửi lên Backend BS-12
function validateForm(formValues) {
  const title = formValues.title.trim()
  const author = formValues.author.trim()
  const description = formValues.description.trim()
  const priceText = String(formValues.price).trim()
  const stockText = String(formValues.stock).trim()

  if (!title) {
    return { error: 'Vui lòng nhập tên sách.' }
  }
  if (title.length > 255) {
    return { error: 'Tên sách không được vượt quá 255 ký tự.' }
  }

  if (!author) {
    return { error: 'Vui lòng nhập tên tác giả.' }
  }
  if (author.length > 150) {
    return { error: 'Tên tác giả không được vượt quá 150 ký tự.' }
  }

  if (priceText === '') {
    return { error: 'Vui lòng nhập giá bán.' }
  }
  const price = Number(priceText)
  if (!Number.isInteger(price) || price < 0 || price > MAX_INT) {
    return { error: 'Giá bán phải là số nguyên từ 0 đến 2.147.483.647.' }
  }

  if (stockText === '') {
    return { error: 'Vui lòng nhập số lượng tồn kho.' }
  }
  const stock = Number(stockText)
  if (!Number.isInteger(stock) || stock < 0 || stock > MAX_INT) {
    return { error: 'Số lượng tồn kho phải là số nguyên từ 0 đến 2.147.483.647.' }
  }

  return {
    payload: {
      title,
      author,
      description: description === '' ? null : description,
      price,
      stock,
    },
  }
}

function AdminDashboard({ admin, onLogout }) {
  // Danh sách sách & trạng thái tải
  const [books, setBooks] = useState([])
  const [loadingBooks, setLoadingBooks] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Trạng thái đăng xuất
  const [loggingOut, setLoggingOut] = useState(false)

  // Thông báo thao tác (thêm / sửa / xóa)
  const [successMessage, setSuccessMessage] = useState('')
  const [actionError, setActionError] = useState('')

  // Form thêm / chỉnh sửa sách: null (đóng), 'create' (thêm), 'edit' (sửa)
  const [formMode, setFormMode] = useState(null)
  const [editingBookId, setEditingBookId] = useState(null)
  const [formValues, setFormValues] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Hộp thoại xác nhận xóa
  const [bookToDelete, setBookToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const formPanelRef = useRef(null)

  // Cuộn mượt tới form khi mở chế độ thêm hoặc chỉnh sửa
  useEffect(() => {
    if (formMode !== null) {
      formPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [formMode, editingBookId])

  // Cho phép nhấn Escape để đóng hộp thoại xác nhận xóa
  useEffect(() => {
    if (!bookToDelete) return

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !deleting) {
        setBookToDelete(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bookToDelete, deleting])

  // Tải danh sách sách khi mở trang quản trị
  useEffect(() => {
    let ignore = false

    getAdminBooks()
      .then((data) => {
        if (!ignore) setBooks(data)
      })
      .catch((err) => {
        if (ignore) return
        if (err.status === 401) {
          onLogout()
          return
        }
        if (err instanceof TypeError) {
          setLoadError('Không thể kết nối tới máy chủ. Vui lòng kiểm tra Backend.')
        } else {
          setLoadError(err.message || 'Không thể tải danh sách sách.')
        }
      })
      .finally(() => {
        if (!ignore) setLoadingBooks(false)
      })

    return () => {
      ignore = true
    }
  }, [onLogout])

  // Tải lại danh sách khi bấm nút "Thử lại"
  async function handleRetryLoadBooks() {
    setLoadingBooks(true)
    setLoadError('')
    try {
      const data = await getAdminBooks()
      setBooks(data)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      if (err instanceof TypeError) {
        setLoadError('Không thể kết nối tới máy chủ. Vui lòng kiểm tra Backend.')
      } else {
        setLoadError(err.message || 'Không thể tải danh sách sách.')
      }
    } finally {
      setLoadingBooks(false)
    }
  }

  async function handleLogout() {
    setActionError('')
    setLoggingOut(true)
    try {
      await logoutAdmin()
      onLogout()
    } catch {
      setActionError('Không thể đăng xuất lúc này. Vui lòng thử lại.')
    } finally {
      setLoggingOut(false)
    }
  }

  function handleOpenCreateForm() {
    setSuccessMessage('')
    setActionError('')
    setFormError('')
    setEditingBookId(null)
    setFormValues(EMPTY_FORM)
    setFormMode('create')
  }

  function handleOpenEditForm(book) {
    setSuccessMessage('')
    setActionError('')
    setFormError('')
    setEditingBookId(book.id)
    setFormValues({
      title: book.title,
      author: book.author,
      description: book.description || '',
      price: String(book.price),
      stock: String(book.stock),
    })
    setFormMode('edit')
  }

  function handleCloseForm() {
    if (submitting) return
    setFormMode(null)
    setEditingBookId(null)
    setFormValues(EMPTY_FORM)
    setFormError('')
  }

  function handleInputChange(event) {
    const { name, value } = event.target
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  async function handleFormSubmit(event) {
    event.preventDefault()
    setFormError('')
    setSuccessMessage('')
    setActionError('')

    const { error, payload } = validateForm(formValues)
    if (error) {
      setFormError(error)
      return
    }

    setSubmitting(true)
    try {
      if (formMode === 'create') {
        const created = await createAdminBook(payload)
        setBooks((prev) => [...prev, created])
        setSuccessMessage(`Đã thêm sách "${created.title}" thành công.`)
      } else if (formMode === 'edit' && editingBookId !== null) {
        const updated = await updateAdminBook(editingBookId, payload)
        setBooks((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        )
        setSuccessMessage(`Đã cập nhật sách "${updated.title}" thành công.`)
      }
      setFormMode(null)
      setEditingBookId(null)
      setFormValues(EMPTY_FORM)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      if (err.status === 404 && formMode === 'edit' && editingBookId !== null) {
        setBooks((prev) => prev.filter((item) => item.id !== editingBookId))
        setFormMode(null)
        setEditingBookId(null)
        setFormValues(EMPTY_FORM)
        setActionError(err.message)
        return
      }
      if (err instanceof TypeError) {
        setFormError('Không thể kết nối tới máy chủ. Vui lòng thử lại sau.')
      } else {
        setFormError(err.message || 'Thao tác thất bại. Vui lòng thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmDelete() {
    if (!bookToDelete) return
    const targetBook = bookToDelete
    setDeleting(true)
    setActionError('')
    setSuccessMessage('')

    try {
      await deleteAdminBook(targetBook.id)
      setBooks((prev) => prev.filter((item) => item.id !== targetBook.id))
      if (editingBookId === targetBook.id) {
        setFormMode(null)
        setEditingBookId(null)
        setFormValues(EMPTY_FORM)
        setFormError('')
      }
      setSuccessMessage(`Đã xóa sách "${targetBook.title}" thành công.`)
      setBookToDelete(null)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      if (err.status === 404) {
        setBooks((prev) => prev.filter((item) => item.id !== targetBook.id))
        if (editingBookId === targetBook.id) {
          setFormMode(null)
          setEditingBookId(null)
          setFormValues(EMPTY_FORM)
          setFormError('')
        }
      }
      setBookToDelete(null)
      if (err instanceof TypeError) {
        setActionError('Không thể kết nối tới máy chủ. Vui lòng thử lại sau.')
      } else {
        setActionError(err.message || 'Không thể xóa sách.')
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="container page">
      {/* Thanh thông tin Admin & Đăng xuất */}
      <div className="admin-topbar">
        <div>
          <h2 className="admin-heading">Quản lý sách</h2>
          <p className="admin-subtext">
            Xin chào, <strong>{admin.username}</strong> — Tổng số sách:{' '}
            <strong>{books.length}</strong>
          </p>
        </div>

        <div className="admin-topbar-actions">
          <button
            type="button"
            className="button admin-btn"
            onClick={handleOpenCreateForm}
            disabled={formMode === 'create' || submitting || deleting}
          >
            + Thêm sách mới
          </button>
          <button
            type="button"
            className="button button-danger admin-btn"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
        </div>
      </div>

      {/* Thông báo kết quả thao tác */}
      {successMessage && (
        <div className="alert alert-success" role="status">
          <span>{successMessage}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => setSuccessMessage('')}
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      )}

      {actionError && (
        <div className="alert alert-error" role="alert">
          <span>{actionError}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => setActionError('')}
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      )}

      {/* Form Thêm / Chỉnh sửa sách */}
      {formMode !== null && (
        <div className="admin-panel" ref={formPanelRef}>
          <h3 className="admin-panel-title">
            {formMode === 'create' ? 'Thêm sách mới' : `Chỉnh sửa sách #${editingBookId}`}
          </h3>

          <form className="admin-book-form" onSubmit={handleFormSubmit} noValidate>
            <div className="admin-form-grid">
              <div className="form-group">
                <label htmlFor="book-title">
                  Tên sách <span className="required-mark">*</span>
                </label>
                <input
                  id="book-title"
                  name="title"
                  type="text"
                  value={formValues.title}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: Dế Mèn Phiêu Lưu Ký"
                  maxLength={255}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="book-author">
                  Tác giả <span className="required-mark">*</span>
                </label>
                <input
                  id="book-author"
                  name="author"
                  type="text"
                  value={formValues.author}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: Tô Hoài"
                  maxLength={150}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="book-price">
                  Giá bán (VNĐ) <span className="required-mark">*</span>
                </label>
                <input
                  id="book-price"
                  name="price"
                  type="number"
                  min="0"
                  step="1"
                  value={formValues.price}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: 55000"
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="book-stock">
                  Số lượng tồn kho <span className="required-mark">*</span>
                </label>
                <input
                  id="book-stock"
                  name="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={formValues.stock}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: 20"
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="book-description">Mô tả sách (tùy chọn)</label>
              <textarea
                id="book-description"
                name="description"
                rows="3"
                value={formValues.description}
                onChange={handleInputChange}
                placeholder="Nhập giới thiệu ngắn gọn về nội dung cuốn sách..."
                disabled={submitting}
              />
            </div>

            {formError && <p className="form-error">{formError}</p>}

            <div className="admin-form-actions">
              <button
                type="submit"
                className="button admin-btn"
                disabled={submitting}
              >
                {submitting
                  ? 'Đang lưu...'
                  : formMode === 'create'
                    ? 'Lưu sách mới'
                    : 'Lưu thay đổi'}
              </button>
              <button
                type="button"
                className="button button-secondary admin-btn"
                onClick={handleCloseForm}
                disabled={submitting}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Khu vực danh sách sách */}
      <div className="admin-panel">
        {loadingBooks ? (
          <p className="status-message">Đang tải danh sách sách...</p>
        ) : loadError ? (
          <div className="admin-state-box">
            <p className="error-message">{loadError}</p>
            <button
              type="button"
              className="button admin-btn"
              onClick={handleRetryLoadBooks}
            >
              Thử lại
            </button>
          </div>
        ) : books.length === 0 ? (
          <div className="admin-state-box">
            <p className="status-message">
              Chưa có cuốn sách nào trong hệ thống. Hãy bấm &ldquo;+ Thêm sách mới&rdquo; để bắt đầu.
            </p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên sách</th>
                  <th>Tác giả</th>
                  <th>Giá bán</th>
                  <th>Tồn kho</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <tr key={book.id}>
                    <td data-label="ID">#{book.id}</td>
                    <td data-label="Tên sách">
                      <div className="admin-book-info">
                        <div className="admin-book-title">{book.title}</div>
                        {book.description && (
                          <div className="admin-book-desc">{book.description}</div>
                        )}
                      </div>
                    </td>
                    <td data-label="Tác giả">{book.author}</td>
                    <td data-label="Giá bán" className="admin-book-price">
                      {formatPrice(book.price)}
                    </td>
                    <td data-label="Tồn kho">
                      <span
                        className={
                          book.stock > 0 ? 'stock-badge' : 'stock-badge stock-empty'
                        }
                      >
                        {book.stock > 0 ? `${book.stock} cuốn` : 'Hết hàng'}
                      </span>
                    </td>
                    <td data-label="Thao tác">
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="button button-small admin-btn"
                          onClick={() => handleOpenEditForm(book)}
                          disabled={submitting || deleting}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="button button-small button-danger admin-btn"
                          onClick={() => setBookToDelete(book)}
                          disabled={submitting || deleting}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hộp thoại xác nhận trước khi xóa */}
      {bookToDelete && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          onClick={() => {
            if (!deleting) setBookToDelete(null)
          }}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 id="delete-modal-title">Xác nhận xóa sách</h3>
            <p>
              Bạn có chắc chắn muốn xóa cuốn sách{' '}
              <strong>&ldquo;{bookToDelete.title}&rdquo;</strong> (tác giả:{' '}
              {bookToDelete.author}) không? Hành động này không thể hoàn tác.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary admin-btn"
                onClick={() => setBookToDelete(null)}
                disabled={deleting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="button button-danger admin-btn"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard