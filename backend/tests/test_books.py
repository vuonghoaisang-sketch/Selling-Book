import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app import create_app
from backend.models import Base, Book


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
def client(session_factory):
    """Tạo Flask test client dùng database tạm ở trên."""
    app = create_app(session_factory=session_factory)
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


def add_sample_books(session_factory):
    """Thêm 2 cuốn sách mẫu vào database tạm."""
    with session_factory() as session:
        session.add_all([
            Book(
                title="Dế Mèn Phiêu Lưu Ký",
                author="Tô Hoài",
                description="Truyện thiếu nhi",
                price=50000,
                stock=10,
            ),
            Book(
                title="Nhà Giả Kim",
                author="Paulo Coelho",
                description=None,
                price=70000,
                stock=5,
            ),
        ])
        session.commit()


def test_list_books(client, session_factory):
    """GET /api/books trả về HTTP 200 và đủ danh sách sách."""
    add_sample_books(session_factory)

    response = client.get("/api/books")

    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 2
    assert data[0] == {
        "id": 1,
        "title": "Dế Mèn Phiêu Lưu Ký",
        "author": "Tô Hoài",
        "description": "Truyện thiếu nhi",
        "price": 50000,
        "stock": 10,
    }
    assert data[1]["title"] == "Nhà Giả Kim"


def test_list_books_empty(client):
    """GET /api/books trả về danh sách rỗng khi chưa có sách."""
    response = client.get("/api/books")

    assert response.status_code == 200
    assert response.get_json() == []


def test_get_book_detail(client, session_factory):
    """GET /api/books/<id> trả về HTTP 200 và đúng thông tin sách."""
    add_sample_books(session_factory)

    response = client.get("/api/books/2")

    assert response.status_code == 200
    assert response.get_json() == {
        "id": 2,
        "title": "Nhà Giả Kim",
        "author": "Paulo Coelho",
        "description": None,
        "price": 70000,
        "stock": 5,
    }


def test_get_book_not_found(client):
    """GET /api/books/<id> trả về HTTP 404 khi không có sách."""
    response = client.get("/api/books/999")

    assert response.status_code == 404
    assert response.get_json() == {"error": "Book not found"}