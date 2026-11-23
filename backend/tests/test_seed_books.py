import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.models import Base, Book
from backend.seed_books import SAMPLE_BOOKS, main, seed_books


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


def test_seed_books_adds_sample_books(session_factory):
    """Kiểm tra seed thêm đầy đủ các sách mẫu vào database."""
    with session_factory() as session:
        result = seed_books(session)
        books = session.scalars(select(Book).order_by(Book.id)).all()

    assert result == {"added": len(SAMPLE_BOOKS), "skipped": 0}
    assert len(books) == len(SAMPLE_BOOKS)


def test_seed_books_is_idempotent(session_factory):
    """Kiểm tra chạy seed lần thứ hai không tạo bản ghi trùng lặp."""
    with session_factory() as session:
        first_result = seed_books(session)
        second_result = seed_books(session)
        books = session.scalars(select(Book)).all()

    assert first_result == {"added": len(SAMPLE_BOOKS), "skipped": 0}
    assert second_result == {"added": 0, "skipped": len(SAMPLE_BOOKS)}
    assert len(books) == len(SAMPLE_BOOKS)


def test_seed_books_skips_existing_and_preserves_data(session_factory):
    """Kiểm tra sách đã tồn tại được bỏ qua và không bị ghi đè dữ liệu cũ."""
    existing_sample = SAMPLE_BOOKS[0]
    with session_factory() as session:
        session.add(
            Book(
                title=existing_sample["title"],
                author=existing_sample["author"],
                description="Mô tả tùy chỉnh của cửa hàng",
                price=99000,
                stock=3,
            )
        )
        session.commit()

        result = seed_books(session)
        preserved = session.scalars(
            select(Book).where(
                Book.title == existing_sample["title"],
                Book.author == existing_sample["author"],
            )
        ).first()
        total_books = session.scalars(select(Book)).all()

    assert result == {"added": len(SAMPLE_BOOKS) - 1, "skipped": 1}
    assert len(total_books) == len(SAMPLE_BOOKS)
    assert preserved is not None
    assert preserved.description == "Mô tả tùy chỉnh của cửa hàng"
    assert preserved.price == 99000
    assert preserved.stock == 3


def test_seed_books_data_validity(session_factory):
    """Kiểm tra dữ liệu sách mẫu hợp lệ và rollback khi gặp dữ liệu không hợp lệ."""
    with session_factory() as session:
        seed_books(session)
        books = session.scalars(select(Book)).all()

    for book in books:
        assert bool(book.title and book.title.strip())
        assert bool(book.author and book.author.strip())
        assert book.price >= 0
        assert book.stock >= 0

    invalid_books = [
        {
            "title": "Sách lỗi giá âm",
            "author": "Tác giả test",
            "description": None,
            "price": -1000,
            "stock": 5,
        }
    ]
    with session_factory() as session:
        with pytest.raises(IntegrityError):
            seed_books(session, books_data=invalid_books)
        remaining = session.scalars(select(Book)).all()

    assert len(remaining) == len(SAMPLE_BOOKS)


def test_main_refuses_without_confirmation(monkeypatch, capsys):
    """Kiểm tra script từ chối chạy nếu chưa đặt biến môi trường SEED_BOOKS=1."""
    monkeypatch.delenv("SEED_BOOKS", raising=False)
    exit_code = main()
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "SEED_BOOKS=1" in captured.out
