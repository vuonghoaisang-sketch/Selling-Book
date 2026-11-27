import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildOrderPayload,
  createOrder,
  isMockOrder,
  OrderError,
  submitOrder,
} from '../src/api/orders.js'
import { CART_STORAGE_KEY, loadCart, saveCart } from '../src/utils/cart.js'

function createMemoryStorage() {
  const store = new Map()
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

function mockFetchJson(status, body) {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return body
      },
    }
  }
  return calls
}

test('submitOrder đã chuyển sang API thật createOrder', () => {
  assert.equal(submitOrder, createOrder)
  assert.equal(isMockOrder, false)
})

test('buildOrderPayload chỉ gửi book_id và quantity, không gửi giá tiền', () => {
  const payload = buildOrderPayload(
    {
      customer_name: '  Nguyễn Văn A  ',
      phone: ' 0901234567 ',
      shipping_address: '  Huế, Việt Nam  ',
    },
    [
      { book_id: 1, title: 'Sách A', price: 100000, quantity: 2 },
      { book_id: 2, title: 'Sách B', price: 50000, quantity: 1 },
    ],
  )

  assert.deepEqual(payload, {
    customer_name: 'Nguyễn Văn A',
    phone: '0901234567',
    shipping_address: 'Huế, Việt Nam',
    items: [
      { book_id: 1, quantity: 2 },
      { book_id: 2, quantity: 1 },
    ],
  })
})

test('1 & 2. Đặt hàng hợp lệ (1 hoặc nhiều sách) trả về mã đơn và tổng tiền thực tế', async () => {
  const calls = mockFetchJson(201, {
    message: 'Đặt hàng thành công',
    order: {
      id: 123,
      total_amount: 250000,
      items: [
        { book_id: 1, quantity: 2, unit_price: 100000, subtotal: 200000 },
        { book_id: 2, quantity: 1, unit_price: 50000, subtotal: 50000 },
      ],
    },
  })

  const payload = buildOrderPayload(
    {
      customer_name: 'Nguyễn Văn A',
      phone: '0901234567',
      shipping_address: 'Huế, Việt Nam',
    },
    [
      { book_id: 1, price: 100000, quantity: 2 },
      { book_id: 2, price: 50000, quantity: 1 },
    ],
  )

  const result = await submitOrder(payload)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/orders')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(result.order.id, 123)
  assert.equal(result.order.total_amount, 250000)
})

test('3. Đặt hàng thất bại do dữ liệu không hợp lệ (HTTP 400)', async () => {
  mockFetchJson(400, { message: 'Số điện thoại không được để trống' })

  await assert.rejects(
    () => submitOrder({ customer_name: 'A', phone: '', shipping_address: 'Huế', items: [] }),
    (error) => {
      assert.ok(error instanceof OrderError)
      assert.equal(error.status, 400)
      assert.equal(error.message, 'Số điện thoại không được để trống')
      return true
    },
  )
})

test('4. Sách không tồn tại (HTTP 404)', async () => {
  mockFetchJson(404, { message: 'Không tìm thấy sách có mã 999' })

  await assert.rejects(
    () =>
      submitOrder({
        customer_name: 'A',
        phone: '0901234567',
        shipping_address: 'Huế',
        items: [{ book_id: 999, quantity: 1 }],
      }),
    (error) => {
      assert.ok(error instanceof OrderError)
      assert.equal(error.status, 404)
      assert.equal(error.message, 'Không tìm thấy sách có mã 999')
      return true
    },
  )
})

test('5. Số lượng tồn kho không đủ (HTTP 409)', async () => {
  mockFetchJson(409, { message: 'Sách "Dế Mèn" không đủ số lượng trong kho (còn 1)' })

  await assert.rejects(
    () =>
      submitOrder({
        customer_name: 'A',
        phone: '0901234567',
        shipping_address: 'Huế',
        items: [{ book_id: 1, quantity: 5 }],
      }),
    (error) => {
      assert.ok(error instanceof OrderError)
      assert.equal(error.status, 409)
      assert.match(error.message, /không đủ số lượng/)
      return true
    },
  )
})

test('6. Lỗi máy chủ (HTTP 500) và mất kết nối Backend (Network error)', async () => {
  mockFetchJson(500, { message: 'Không thể đặt hàng lúc này. Vui lòng thử lại sau' })
  await assert.rejects(
    () => submitOrder({}),
    (error) => error instanceof OrderError && error.status === 500,
  )

  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch')
  }
  await assert.rejects(
    () => submitOrder({}),
    (error) => {
      assert.ok(error instanceof OrderError)
      assert.equal(error.status, null)
      assert.match(error.message, /Không thể kết nối Backend/)
      return true
    },
  )
})

test('7 & 8. Giỏ hàng giữ nguyên khi lỗi và chỉ xóa sau khi đặt hàng thành công', async () => {
  globalThis.localStorage = createMemoryStorage()
  const initialCart = [
    { book_id: 1, title: 'Sách 1', author: 'TG', price: 100000, stock: 5, quantity: 2 },
  ]
  saveCart(initialCart)

  mockFetchJson(409, { message: 'Hết hàng' })
  try {
    await submitOrder(buildOrderPayload({ customer_name: 'A', phone: '0901234567', shipping_address: 'Huế' }, loadCart()))
  } catch {
    // Giữ nguyên giỏ hàng
  }
  assert.equal(loadCart().length, 1)
  assert.ok(globalThis.localStorage.getItem(CART_STORAGE_KEY))

  mockFetchJson(201, {
    message: 'Đặt hàng thành công',
    order: { id: 10, total_amount: 200000, items: [] },
  })
  const res = await submitOrder(
    buildOrderPayload({ customer_name: 'A', phone: '0901234567', shipping_address: 'Huế' }, loadCart()),
  )
  if (res?.order?.id) {
    saveCart([])
  }
  assert.equal(loadCart().length, 0)
  assert.equal(globalThis.localStorage.getItem(CART_STORAGE_KEY), null)
})

test('9. Chặn gửi nhiều request liên tiếp khi đang xử lý', async () => {
  let fetchCount = 0
  let resolveFetch
  globalThis.fetch = () => {
    fetchCount += 1
    return new Promise((resolve) => {
      resolveFetch = resolve
    })
  }

  let submitting = false
  async function handleCheckoutSubmit() {
    if (submitting) return null
    submitting = true
    try {
      return await submitOrder({
        customer_name: 'A',
        phone: '0901234567',
        shipping_address: 'Huế',
        items: [{ book_id: 1, quantity: 1 }],
      })
    } finally {
      submitting = false
    }
  }

  const firstAttempt = handleCheckoutSubmit()
  const secondAttempt = handleCheckoutSubmit()

  assert.equal(fetchCount, 1)
  assert.equal(await secondAttempt, null)

  resolveFetch({
    ok: true,
    status: 201,
    async json() {
      return { message: 'Đặt hàng thành công', order: { id: 11, total_amount: 100000, items: [] } }
    },
  })

  const firstResult = await firstAttempt
  assert.equal(firstResult.order.id, 11)
  assert.equal(submitting, false)
})