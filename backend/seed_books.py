import os

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from backend.db import get_database_url
from backend.models import Book

SAMPLE_BOOKS: list[dict] = [
    {
        "title": "Dế Mèn Phiêu Lưu Ký",
        "author": "Tô Hoài",
        "description": (
            "Tác phẩm văn học thiếu nhi kinh điển của nhà văn Tô Hoài "
            "kể về hành trình phiêu lưu của chú Dế Mèn."
        ),
        "price": 55000,
        "stock": 20,
    },
    {
        "title": "Nhà Giả Kim",
        "author": "Paulo Coelho",
        "description": (
            "Tiểu thuyết nổi tiếng về hành trình theo đuổi ước mơ "
            "và lắng nghe trái tim của chàng chăn cừu Santiago."
        ),
        "price": 79000,
        "stock": 15,
    },
    {
        "title": "Đắc Nhân Tâm",
        "author": "Dale Carnegie",
        "description": (
            "Cuốn sách kỹ năng giao tiếp và ứng xử kinh điển "
            "giúp xây dựng mối quan hệ bền vững."
        ),
        "price": 86000,
        "stock": 25,
    },
    {
        "title": "Mắt Biếc",
        "author": "Nguyễn Nhật Ánh",
        "description": (
            "Câu chuyện tình cảm tuổi học trò trong sáng, sâu lắng "
            "gắn liền với ký ức làng Đo Đo."
        ),
        "price": 110000,
        "stock": 18,
    },
    {
        "title": "Tuổi Trẻ Đáng Giá Bao Nhiêu",
        "author": "Rosie Nguyễn",
        "description": (
            "Cuốn sách truyền cảm hứng học hỏi, trải nghiệm "
            "và khám phá bản thân dành cho người trẻ."
        ),
        "price": 90000,
        "stock": 12,
    },
    {
        "title": "Số Đỏ",
        "author": "Vũ Trọng Phụng",
        "description": (
            "Tác phẩm văn học hiện thực phê phán xuất sắc "
            "phản ánh xã hội Việt Nam đầu thế kỷ XX."
        ),
        "price": 68000,
        "stock": 10,
    },
]


def seed_books(session: Session, books_data: list[dict] | None = None) -> dict[str, int]:
    """Thêm dữ liệu sách mẫu vào database thông qua SQLAlchemy session.

    - Dùng cặp (title, author) để kiểm tra sách đã tồn tại.
    - Bỏ qua sách đã tồn tại, tuyệt đối không ghi đè dữ liệu cũ.
    - Trả về dict thống kê số sách đã thêm và số sách đã bỏ qua.
    """
    if books_data is None:
        books_data = SAMPLE_BOOKS

    added = 0
    skipped = 0

    try:
        for item in books_data:
            existing_book = session.scalars(
                select(Book).where(
                    Book.title == item["title"],
                    Book.author == item["author"],
                )
            ).first()

            if existing_book is not None:
                skipped += 1
                continue

            book = Book(
                title=item["title"],
                author=item["author"],
                description=item.get("description"),
                price=item["price"],
                stock=item["stock"],
            )
            session.add(book)
            added += 1

        session.commit()
    except Exception:
        session.rollback()
        raise

    return {"added": added, "skipped": skipped}


def main() -> int:
    """Điểm chạy chính của seed script, yêu cầu SEED_BOOKS=1 để xác nhận."""
    if os.getenv("SEED_BOOKS") != "1":
        print("Từ chối chạy seed: vui lòng đặt biến môi trường SEED_BOOKS=1 để xác nhận.")
        return 1

    engine = create_engine(get_database_url(), pool_pre_ping=True)
    session_factory = sessionmaker(bind=engine)

    try:
        with session_factory() as session:
            result = seed_books(session)
        print(
            f"Hoàn tất seed sách mẫu: đã thêm {result['added']} quyển, "
            f"bỏ qua {result['skipped']} quyển đã tồn tại."
        )
        return 0
    except Exception as exc:
        print(f"Lỗi khi seed dữ liệu sách mẫu: {type(exc).__name__}")
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
