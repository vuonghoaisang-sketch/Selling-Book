// Các hàm gọi API quản lý sách dành cho Admin (BS-12)
// Luôn gửi kèm credentials: 'include' để trình duyệt đính kèm Flask Session cookie
const API_URL = import.meta.env.VITE_API_URL || ''

function formatApiError(status, backendError, fallbackMessage) {
  if (status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  }
  if (status === 404) {
    return 'Không tìm thấy cuốn sách này (có thể đã bị xóa).'
  }
  if (status === 409) {
    return 'Không thể xóa sách vì sách này đã tồn tại trong đơn hàng.'
  }
  return backendError || fallbackMessage
}

function createApiError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

async function requestAdminBooks(path, options, fallbackMessage, validateData) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = formatApiError(
      response.status,
      data?.error,
      fallbackMessage
    )
    throw createApiError(response.status, message)
  }

  if (validateData && !validateData(data)) {
    throw createApiError(response.status, 'Phản hồi từ máy chủ không hợp lệ.')
  }

  return data
}

// 1. Lấy danh sách toàn bộ sách (GET /api/admin/books)
export function getAdminBooks() {
  return requestAdminBooks(
    '/api/admin/books',
    { method: 'GET' },
    'Không thể tải danh sách sách.',
    (data) => Array.isArray(data)
  )
}

// 2. Thêm sách mới (POST /api/admin/books)
export function createAdminBook(bookData) {
  return requestAdminBooks(
    '/api/admin/books',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookData),
    },
    'Không thể thêm sách mới. Vui lòng thử lại.',
    (data) => data !== null && typeof data === 'object'
  )
}

// 3. Cập nhật thông tin sách (PATCH /api/admin/books/<id>)
export function updateAdminBook(bookId, bookData) {
  return requestAdminBooks(
    `/api/admin/books/${bookId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookData),
    },
    'Không thể cập nhật sách. Vui lòng thử lại.',
    (data) => data !== null && typeof data === 'object'
  )
}

// 4. Xóa sách (DELETE /api/admin/books/<id>)
export function deleteAdminBook(bookId) {
  return requestAdminBooks(
    `/api/admin/books/${bookId}`,
    { method: 'DELETE' },
    'Không thể xóa sách. Vui lòng thử lại.'
  )
}
