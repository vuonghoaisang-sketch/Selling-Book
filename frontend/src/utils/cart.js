// Các hàm xử lý giỏ hàng, không phụ thuộc React nên dễ đọc và dễ kiểm tra
// Một dòng trong giỏ: { book_id, title, author, price, stock, quantity }
// stock là null khi không biết tồn kho

// Key riêng cho giỏ hàng trong localStorage, không dùng chung với dữ liệu khác
export const CART_STORAGE_KEY = 'selling_book_cart'

// Kiểm tra và làm sạch một dòng đọc từ localStorage
// Trả về null nếu dòng không hợp lệ
function cleanItem(item) {
  if (item === null || typeof item !== 'object') return null

  const { book_id, title, author, price, stock, quantity } = item
  if (!Number.isInteger(book_id)) return null
  if (typeof title !== 'string' || title === '') return null
  if (!Number.isInteger(price) || price < 0) return null
  if (!Number.isInteger(quantity) || quantity < 1) return null

  const validStock = Number.isInteger(stock) && stock >= 0 ? stock : null
  if (validStock === 0) return null

  return {
    book_id,
    title,
    author: typeof author === 'string' ? author : '',
    price,
    stock: validStock,
    quantity: validStock === null ? quantity : Math.min(quantity, validStock),
  }
}

// Đọc giỏ hàng từ localStorage. Dữ liệu lỗi thì trả về giỏ rỗng
export function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []

    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []

    const cart = []
    for (const item of data) {
      const clean = cleanItem(item)
      // Bỏ dòng lỗi và dòng trùng book_id
      if (clean && !cart.some((c) => c.book_id === clean.book_id)) {
        cart.push(clean)
      }
    }
    return cart
  } catch {
    return []
  }
}

// Lưu giỏ hàng vào localStorage. Giỏ rỗng thì xóa key
export function saveCart(cart) {
  try {
    if (cart.length === 0) {
      localStorage.removeItem(CART_STORAGE_KEY)
    } else {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    }
  } catch {
    // Bỏ qua nếu trình duyệt không cho lưu (chế độ riêng tư, hết dung lượng)
  }
}

// Thêm một cuốn sách (object lấy từ API) vào giỏ
// Trả về { cart: giỏ mới, status: kết quả }
// status: 'added', 'increased', 'max_reached', 'out_of_stock' hoặc 'invalid'
export function addToCart(cart, book) {
  if (!Number.isInteger(book.id) || !Number.isInteger(book.price) || book.price < 0) {
    return { cart, status: 'invalid' }
  }

  const stock = Number.isInteger(book.stock) && book.stock >= 0 ? book.stock : null
  if (stock === 0) {
    return { cart, status: 'out_of_stock' }
  }

  const existing = cart.find((item) => item.book_id === book.id)
  if (existing) {
    if (stock !== null && existing.quantity >= stock) {
      return { cart, status: 'max_reached' }
    }
    const newCart = cart.map((item) =>
      item.book_id === book.id
        ? { ...item, stock, quantity: item.quantity + 1 }
        : item,
    )
    return { cart: newCart, status: 'increased' }
  }

  const newItem = {
    book_id: book.id,
    title: book.title,
    author: book.author,
    price: book.price,
    stock,
    quantity: 1,
  }
  return { cart: [...cart, newItem], status: 'added' }
}

// Tăng hoặc giảm số lượng (delta là +1 hoặc -1)
// Số lượng không nhỏ hơn 1 và không vượt quá tồn kho
export function changeQuantity(cart, bookId, delta) {
  return cart.map((item) => {
    if (item.book_id !== bookId) return item

    let newQuantity = item.quantity + delta
    if (newQuantity < 1) newQuantity = 1
    if (item.stock !== null && newQuantity > item.stock) newQuantity = item.stock
    return { ...item, quantity: newQuantity }
  })
}

// Xóa một cuốn sách khỏi giỏ
export function removeFromCart(cart, bookId) {
  return cart.filter((item) => item.book_id !== bookId)
}

// Thành tiền của một dòng
export function getItemSubtotal(item) {
  return item.price * item.quantity
}

// Tổng số lượng sách trong giỏ
export function getTotalQuantity(cart) {
  return cart.reduce((sum, item) => sum + item.quantity, 0)
}

// Tổng tiền dự kiến (chỉ để hiển thị, Backend sẽ tính lại khi đặt hàng)
export function getTotalPrice(cart) {
  return cart.reduce((sum, item) => sum + getItemSubtotal(item), 0)
}

// Định dạng tiền Việt, ví dụ 55000 thành "55.000đ"
export function formatPrice(value) {
  return `${value.toLocaleString('vi-VN')}đ`
}

// Chuyển giỏ hàng thành danh sách gửi lên Backend
// Chỉ gồm book_id và quantity, KHÔNG gửi giá tiền
export function toOrderItems(cart) {
  return cart.map((item) => ({
    book_id: item.book_id,
    quantity: item.quantity,
  }))
}