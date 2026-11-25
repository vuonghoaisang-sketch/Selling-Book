import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from werkzeug.security import generate_password_hash

from backend.app import create_app
from backend.models import Admin, Base, Book


@pytest.fixture
def session_factory():
    """Tạo database SQLite tạm trong bộ nhớ, không đụng đến PostgreSQL thật."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine)
    engine.dispose()


@pytest.fixture
def client(session_factory, monkeypatch):
    """Tạo Flask test client với SECRET_KEY giả lập cho session."""
    monkeypatch.setenv("FLASK_SECRET_KEY", "test-secret-key-not-for-prod")
    app = create_app(session_factory=session_factory)
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


@pytest.fixture
def admin_client(client, session_factory):
    """Test client đã đăng nhập bằng một tài khoản Admin mẫu."""
    with session_factory() as db_session:
        db_session.add(
            Admin(
                username="admin_test",
                password_hash=generate_password_hash("secret123"),
            )
        )
        db_session.commit()

    response = client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "secret123"},
    )
    assert response.status_code == 200
    return client


def add_book(session_factory, title="Dế Mèn Phiêu Lưu Ký", author="Tô Hoài",
             description="Truyện thiếu nhi", price=50000, stock=10):
    """Thêm một cuốn sách vào database tạm và trả về id của nó."""
    with session_factory() as db_session:
        book = Book(
            title=title,
            author=author,
            description=description,
            price=price,
            stock=stock,
        )
        db_session.add(book)
        db_session.commit()
        db_session.refresh(book)
        return book.id


def count_books(session_factory):
    """Đếm số sách hiện có trong database tạm."""
    with session_factory() as db_session:
        return len(db_session.scalars(select(Book)).all())


def get_book_from_db(session_factory, book_id):
    """Đọc trực tiếp một cuốn sách từ database tạm (None nếu không có)."""
    with session_factory() as db_session:
        book = db_session.get(Book, book_id)
        if book is None:
            return None
        return {
            "title": book.title,
            "author": book.author,
            "description": book.description,
            "price": book.price,
            "stock": book.stock,
        }


VALID_BOOK = {
    "title": "Nhà Giả Kim",
    "author": "Paulo Coelho",
    "description": "Tiểu thuyết",
    "price": 79000,
    "stock": 5,
}


# ---------- 1, 2: Lấy danh sách ----------

def test_admin_list_books_success(admin_client, session_factory):
    """Admin đã đăng nhập xem được danh sách sách."""
    add_book(session_factory, title="Sách A")
    add_book(session_factory, title="Sách B")

    response = admin_client.get("/api/admin/books")

    assert response.status_code == 200
    data = response.get_json()
    assert [book["title"] for book in data] == ["Sách A", "Sách B"]


def test_admin_list_books_empty(admin_client):
    """Chưa có sách nào thì trả về danh sách rỗng."""
    response = admin_client.get("/api/admin/books")

    assert response.status_code == 200
    assert response.get_json() == []


# ---------- 11: Chưa đăng nhập ----------

@pytest.mark.parametrize(
    "method, url, body",
    [
        ("GET", "/api/admin/books", None),
        ("POST", "/api/admin/books", VALID_BOOK),
        ("PATCH", "/api/admin/books/1", {"price": 1000}),
        ("DELETE", "/api/admin/books/1", None),
    ],
)
def test_admin_books_require_login(client, session_factory, method, url, body):
    """Người chưa đăng nhập nhận 401 ở cả 4 API quản lý sách."""
    book_id = add_book(session_factory)
    assert book_id == 1

    response = client.open(url, method=method, json=body)

    assert response.status_code == 401
    assert response.get_json() == {"error": "Unauthorized"}
    # Dữ liệu không bị thay đổi
    assert count_books(session_factory) == 1
    assert get_book_from_db(session_factory, 1)["price"] == 50000


def test_admin_books_reject_deleted_admin_session(admin_client, session_factory):
    """Session còn nhưng tài khoản Admin đã bị xóa thì vẫn bị từ chối (401)."""
    with session_factory() as db_session:
        for admin in db_session.scalars(select(Admin)).all():
            db_session.delete(admin)
        db_session.commit()

    response = admin_client.get("/api/admin/books")

    assert response.status_code == 401


# ---------- 3: Thêm sách thành công ----------

def test_create_book_success(admin_client, session_factory):
    """Thêm sách hợp lệ trả về 201 và lưu vào database."""
    response = admin_client.post("/api/admin/books", json=VALID_BOOK)

    assert response.status_code == 201
    data = response.get_json()
    assert data["id"] is not None
    assert data["title"] == "Nhà Giả Kim"
    assert data["author"] == "Paulo Coelho"
    assert data["price"] == 79000
    assert data["stock"] == 5
    assert get_book_from_db(session_factory, data["id"])["title"] == "Nhà Giả Kim"


def test_create_book_without_description(admin_client):
    """Description là tùy chọn, không gửi lên vẫn thêm được."""
    body = {k: v for k, v in VALID_BOOK.items() if k != "description"}

    response = admin_client.post("/api/admin/books", json=body)

    assert response.status_code == 201
    assert response.get_json()["description"] is None


def test_create_book_trims_title_and_author(admin_client):
    """Khoảng trắng thừa ở đầu và cuối title, author bị cắt bỏ."""
    body = {**VALID_BOOK, "title": "  Nhà Giả Kim  ", "author": " Paulo Coelho "}

    response = admin_client.post("/api/admin/books", json=body)

    assert response.status_code == 201
    assert response.get_json()["title"] == "Nhà Giả Kim"
    assert response.get_json()["author"] == "Paulo Coelho"


# ---------- 4, 5: Thêm sách với dữ liệu sai ----------

def _without(field):
    return {k: v for k, v in VALID_BOOK.items() if k != field}


@pytest.mark.parametrize(
    "body",
    [
        _without("title"),
        _without("author"),
        _without("price"),
        _without("stock"),
        {**VALID_BOOK, "title": ""},
        {**VALID_BOOK, "title": "   "},
        {**VALID_BOOK, "author": ""},
        {**VALID_BOOK, "title": 123},
        {**VALID_BOOK, "author": None},
        {**VALID_BOOK, "price": "50000"},
        {**VALID_BOOK, "price": 1.5},
        {**VALID_BOOK, "price": True},
        {**VALID_BOOK, "stock": "10"},
        {**VALID_BOOK, "stock": 2.5},
        {**VALID_BOOK, "description": 123},
        {**VALID_BOOK, "title": "a" * 256},
        {**VALID_BOOK, "price": 2147483648},
        ["không", "phải", "object"],
    ],
)
def test_create_book_invalid_data(admin_client, session_factory, body):
    """Dữ liệu thiếu hoặc sai kiểu bị từ chối với 400 và không lưu gì."""
    response = admin_client.post("/api/admin/books", json=body)

    assert response.status_code == 400
    assert "error" in response.get_json()
    assert count_books(session_factory) == 0


@pytest.mark.parametrize("field", ["price", "stock"])
def test_create_book_negative_number(admin_client, session_factory, field):
    """Giá hoặc số lượng âm bị từ chối."""
    response = admin_client.post("/api/admin/books", json={**VALID_BOOK, field: -1})

    assert response.status_code == 400
    assert response.get_json()["error"] == f"{field} must not be negative"
    assert count_books(session_factory) == 0


def test_create_book_zero_price_and_stock_allowed(admin_client):
    """Giá và số lượng bằng 0 là hợp lệ (không âm)."""
    response = admin_client.post(
        "/api/admin/books", json={**VALID_BOOK, "price": 0, "stock": 0}
    )

    assert response.status_code == 201


def test_create_book_body_not_json(admin_client, session_factory):
    """Gửi nội dung không phải JSON thì nhận 400."""
    response = admin_client.post(
        "/api/admin/books", data="khong phai json", content_type="text/plain"
    )

    assert response.status_code == 400
    assert count_books(session_factory) == 0


# ---------- 6, 7, 8: Cập nhật ----------

def test_update_book_success(admin_client, session_factory):
    """Cập nhật một số trường trả về 200, các trường còn lại giữ nguyên."""
    book_id = add_book(session_factory)

    response = admin_client.patch(
        f"/api/admin/books/{book_id}",
        json={"title": "Tên mới", "price": 60000},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["title"] == "Tên mới"
    assert data["price"] == 60000
    assert data["author"] == "Tô Hoài"
    assert data["stock"] == 10

    saved = get_book_from_db(session_factory, book_id)
    assert saved["title"] == "Tên mới"
    assert saved["price"] == 60000


def test_update_book_clear_description(admin_client, session_factory):
    """Có thể xóa mô tả bằng cách gửi description là null."""
    book_id = add_book(session_factory)

    response = admin_client.patch(
        f"/api/admin/books/{book_id}", json={"description": None}
    )

    assert response.status_code == 200
    assert get_book_from_db(session_factory, book_id)["description"] is None


def test_update_book_not_found(admin_client):
    """Cập nhật sách không tồn tại trả về 404."""
    response = admin_client.patch("/api/admin/books/999", json={"price": 1000})

    assert response.status_code == 404
    assert response.get_json() == {"error": "Book not found"}


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"title": ""},
        {"author": "   "},
        {"price": -1},
        {"stock": -5},
        {"price": "abc"},
        {"price": 1.5},
        {"stock": True},
        {"description": 123},
        ["không", "phải", "object"],
    ],
)
def test_update_book_invalid_data(admin_client, session_factory, body):
    """Dữ liệu cập nhật không hợp lệ bị từ chối và sách không bị thay đổi."""
    book_id = add_book(session_factory)
    before = get_book_from_db(session_factory, book_id)

    response = admin_client.patch(f"/api/admin/books/{book_id}", json=body)

    assert response.status_code == 400
    assert "error" in response.get_json()
    assert get_book_from_db(session_factory, book_id) == before


# ---------- 9, 10: Xóa ----------

def test_delete_book_success(admin_client, session_factory):
    """Xóa sách thành công trả về 200 và sách biến mất khỏi database."""
    book_id = add_book(session_factory)

    response = admin_client.delete(f"/api/admin/books/{book_id}")

    assert response.status_code == 200
    assert response.get_json() == {"message": "Book deleted"}
    assert get_book_from_db(session_factory, book_id) is None


def test_delete_book_not_found(admin_client, session_factory):
    """Xóa sách không tồn tại trả về 404 và không ảnh hưởng sách khác."""
    add_book(session_factory)

    response = admin_client.delete("/api/admin/books/999")

    assert response.status_code == 404
    assert response.get_json() == {"error": "Book not found"}
    assert count_books(session_factory) == 1


# ---------- 12: API công khai vẫn hoạt động ----------

def test_public_book_apis_still_work(client, session_factory):
    """GET /api/books và GET /api/books/<id> vẫn dùng được khi chưa đăng nhập."""
    book_id = add_book(session_factory, title="Sách công khai")

    list_response = client.get("/api/books")
    detail_response = client.get(f"/api/books/{book_id}")
    missing_response = client.get("/api/books/999")

    assert list_response.status_code == 200
    assert [book["title"] for book in list_response.get_json()] == ["Sách công khai"]
    assert detail_response.status_code == 200
    assert detail_response.get_json()["title"] == "Sách công khai"
    assert missing_response.status_code == 404


def test_public_apis_reflect_admin_changes(admin_client, session_factory):
    """Sau khi Admin thêm, sửa, xóa thì API công khai phản ánh đúng thay đổi."""
    created = admin_client.post("/api/admin/books", json=VALID_BOOK).get_json()
    book_id = created["id"]
    assert admin_client.get(f"/api/books/{book_id}").get_json()["price"] == 79000

    admin_client.patch(f"/api/admin/books/{book_id}", json={"price": 10000})
    assert admin_client.get(f"/api/books/{book_id}").get_json()["price"] == 10000

    admin_client.delete(f"/api/admin/books/{book_id}")
    assert admin_client.get(f"/api/books/{book_id}").status_code == 404
    assert admin_client.get("/api/books").get_json() == []