from backend.models import Admin, Base, Book, Order, OrderItem


def test_tables_registered_in_metadata():
    """Kiểm tra đủ 4 bảng được khai báo trong Base.metadata."""
    expected_tables = {"admins", "books", "orders", "order_items"}
    assert expected_tables.issubset(set(Base.metadata.tables.keys()))


def test_admin_and_book_columns():
    """Kiểm tra các cột cơ bản của bảng admins và books."""
    admin_cols = set(Admin.__table__.columns.keys())
    assert admin_cols == {"id", "username", "password_hash"}

    book_cols = set(Book.__table__.columns.keys())
    assert book_cols == {"id", "title", "author", "description", "price", "stock"}


def test_order_and_order_item_foreign_keys():
    """Kiểm tra các cột và khóa ngoại của orders và order_items."""
    order_cols = set(Order.__table__.columns.keys())
    assert order_cols == {
        "id", "customer_name", "customer_phone",
        "customer_address", "status", "total_amount",
    }

    order_item_table = OrderItem.__table__
    assert set(order_item_table.columns.keys()) == {
        "id", "order_id", "book_id", "quantity", "unit_price",
    }

    fk_targets = {fk.target_fullname for fk in order_item_table.foreign_keys}
    assert fk_targets == {"orders.id", "books.id"}