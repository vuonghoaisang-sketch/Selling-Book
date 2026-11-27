import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app import create_app
from backend.models import Base, Book, Order, OrderItem


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
    """Tạo Flask test client dùng database tạm."""
    monkeypatch.setenv("FLASK_SECRET_KEY", "test-secret-key-not-for-prod")
    app = create_app(session_factory=session_factory)
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


def add_book(session_factory, title="Dế Mèn Phiêu Lưu Ký", author="Tô Hoài",
             price=100000, stock=10):
    """Thêm một cuốn sách vào database tạm và trả về id của nó."""
    with session_factory() as db_session:
        book = Book(title=title, author=author, description=None,
                    price=price, stock=stock)
        db_session.add(book)
        db_session.commit()
        db_session.refresh(book)
        return book.id


def get_stock(session_factory, book_id):
    with session_factory() as db_session:
        return db_session.get(Book, book_id).stock


def count_orders(session_factory):
    with session_factory() as db_session:
        return len(db_session.scalars(select(Order)).all())


def count_order_items(session_factory):
    with session_factory() as db_session:
        return len(db_session.scalars(select(OrderItem)).all())


def make_payload(items, **overrides):
    """Tạo request đặt hàng hợp lệ theo contract BS-14, có thể ghi đè từng trường."""
    payload = {
        "customer_name": "Nguyễn Văn A",
        "phone": "0901234567",
        "shipping_address": "123 Đường ABC",
        "items": items,
    }
    payload.update(overrides)
    return payload


# ---------- Trường hợp thành công ----------

def test_create_order_single_item(client, session_factory):
    book_id = add_book(session_factory, price=100000, stock=10)

    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": book_id, "quantity": 2}]),
    )

    assert response.status_code == 201
    assert response.get_json() == {
        "message": "Đặt hàng thành công",
        "order": {
            "id": 1,
            "total_amount": 200000,
            "items": [
                {"book_id": book_id, "quantity": 2,
                 "unit_price": 100000, "subtotal": 200000},
            ],
        },
    }
    assert get_stock(session_factory, book_id) == 8


def test_create_order_multiple_items(client, session_factory):
    book_1 = add_book(session_factory, title="Sách 1", price=100000, stock=10)
    book_2 = add_book(session_factory, title="Sách 2", price=50000, stock=5)

    response = client.post(
        "/api/orders",
        json=make_payload([
            {"book_id": book_1, "quantity": 2},
            {"book_id": book_2, "quantity": 1},
        ]),
    )

    assert response.status_code == 201
    order = response.get_json()["order"]
    assert order["total_amount"] == 250000
    assert order["items"] == [
        {"book_id": book_1, "quantity": 2, "unit_price": 100000, "subtotal": 200000},
        {"book_id": book_2, "quantity": 1, "unit_price": 50000, "subtotal": 50000},
    ]
    assert get_stock(session_factory, book_1) == 8
    assert get_stock(session_factory, book_2) == 4


def test_create_order_saves_order_and_items(client, session_factory):
    book_1 = add_book(session_factory, title="Sách 1", price=100000, stock=10)
    book_2 = add_book(session_factory, title="Sách 2", price=50000, stock=5)

    response = client.post(
        "/api/orders",
        json=make_payload(
            [{"book_id": book_1, "quantity": 2}, {"book_id": book_2, "quantity": 1}],
            customer_name="  Trần Thị B  ",
        ),
    )
    order_id = response.get_json()["order"]["id"]

    with session_factory() as db_session:
        order = db_session.get(Order, order_id)
        assert order.customer_name == "Trần Thị B"  # đã cắt khoảng trắng thừa
        assert order.customer_phone == "0901234567"
        assert order.customer_address == "123 Đường ABC"
        assert order.status == "pending"
        assert order.total_amount == 250000

        saved = sorted(
            (i.book_id, i.quantity, i.unit_price) for i in order.items
        )
        assert saved == sorted([(book_1, 2, 100000), (book_2, 1, 50000)])


def test_create_order_can_buy_all_remaining_stock(client, session_factory):
    book_id = add_book(session_factory, stock=3)

    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": book_id, "quantity": 3}]),
    )

    assert response.status_code == 201
    assert get_stock(session_factory, book_id) == 0


def test_create_order_does_not_need_login(client, session_factory):
    """Guest Checkout: không cần đăng nhập Admin hay tài khoản khách."""
    book_id = add_book(session_factory)
    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": book_id, "quantity": 1}]),
    )
    assert response.status_code == 201


def test_unit_price_is_snapshot_when_book_price_changes_later(client, session_factory):
    book_id = add_book(session_factory, price=100000)
    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": book_id, "quantity": 1}]),
    )
    order_id = response.get_json()["order"]["id"]

    with session_factory() as db_session:
        db_session.get(Book, book_id).price = 999999
        db_session.commit()

    with session_factory() as db_session:
        item = db_session.get(Order, order_id).items[0]
        assert item.unit_price == 100000


# ---------- Giá do Backend tự lấy ----------

def test_fake_prices_from_frontend_are_ignored(client, session_factory):
    book_id = add_book(session_factory, price=100000, stock=10)
    payload = make_payload(
        [{"book_id": book_id, "quantity": 2,
          "unit_price": 1, "subtotal": 2, "price": 1}],
        total_amount=2,
        unit_price=1,
    )

    response = client.post("/api/orders", json=payload)

    assert response.status_code == 201
    order = response.get_json()["order"]
    assert order["total_amount"] == 200000
    assert order["items"][0]["unit_price"] == 100000
    assert order["items"][0]["subtotal"] == 200000

    with session_factory() as db_session:
        saved_order = db_session.get(Order, order["id"])
        assert saved_order.total_amount == 200000
        assert saved_order.items[0].unit_price == 100000


# ---------- Dữ liệu không hợp lệ (400) ----------

@pytest.mark.parametrize("field", ["customer_name", "phone", "shipping_address"])
def test_missing_required_text_field(client, session_factory, field):
    book_id = add_book(session_factory)
    payload = make_payload([{"book_id": book_id, "quantity": 1}])
    del payload[field]

    response = client.post("/api/orders", json=payload)

    assert response.status_code == 400
    assert response.get_json()["message"]
    assert count_orders(session_factory) == 0


@pytest.mark.parametrize("field", ["customer_name", "phone", "shipping_address"])
@pytest.mark.parametrize("bad_value", ["", "   ", None, 123, ["a"]])
def test_blank_or_wrong_type_text_field(client, session_factory, field, bad_value):
    book_id = add_book(session_factory)
    payload = make_payload(
        [{"book_id": book_id, "quantity": 1}], **{field: bad_value}
    )

    response = client.post("/api/orders", json=payload)

    assert response.status_code == 400
    assert count_orders(session_factory) == 0


@pytest.mark.parametrize("field, too_long", [
    ("customer_name", "a" * 151),
    ("phone", "1" * 21),
    ("shipping_address", "a" * 501),
])
def test_text_field_too_long(client, session_factory, field, too_long):
    book_id = add_book(session_factory)
    payload = make_payload(
        [{"book_id": book_id, "quantity": 1}], **{field: too_long}
    )

    response = client.post("/api/orders", json=payload)

    assert response.status_code == 400
    assert count_orders(session_factory) == 0


def test_empty_items(client, session_factory):
    response = client.post("/api/orders", json=make_payload([]))
    assert response.status_code == 400
    assert response.get_json()["message"]


def test_missing_items(client):
    payload = make_payload([])
    del payload["items"]
    response = client.post("/api/orders", json=payload)
    assert response.status_code == 400


@pytest.mark.parametrize("bad_items", [
    "abc", 5, None, {"book_id": 1, "quantity": 1}, [1, 2], ["x"], [None],
    [[1, 2]],
])
def test_items_wrong_format(client, session_factory, bad_items):
    add_book(session_factory)
    response = client.post("/api/orders", json=make_payload(bad_items))
    assert response.status_code == 400
    assert count_orders(session_factory) == 0


@pytest.mark.parametrize("bad_book_id", [
    None, "1", 1.5, 1.0, True, 0, -1, 2147483648, [1],
])
def test_invalid_book_id(client, session_factory, bad_book_id):
    add_book(session_factory)
    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": bad_book_id, "quantity": 1}]),
    )
    assert response.status_code == 400
    assert count_orders(session_factory) == 0


def test_missing_book_id(client):
    response = client.post("/api/orders", json=make_payload([{"quantity": 1}]))
    assert response.status_code == 400


@pytest.mark.parametrize("bad_quantity", [0, -1, -100, 2147483648])
def test_quantity_zero_negative_or_too_large(client, session_factory, bad_quantity):
    book_id = add_book(session_factory)
    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": book_id, "quantity": bad_quantity}]),
    )
    assert response.status_code == 400
    assert count_orders(session_factory) == 0


@pytest.mark.parametrize("bad_quantity", [1.5, 2.0, "2", None, True, [2]])
def test_quantity_not_integer(client, session_factory, bad_quantity):
    book_id = add_book(session_factory)
    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": book_id, "quantity": bad_quantity}]),
    )
    assert response.status_code == 400
    assert count_orders(session_factory) == 0


def test_missing_quantity(client, session_factory):
    book_id = add_book(session_factory)
    response = client.post(
        "/api/orders", json=make_payload([{"book_id": book_id}])
    )
    assert response.status_code == 400


def test_duplicate_book_id_in_same_request(client, session_factory):
    book_id = add_book(session_factory, stock=10)
    response = client.post(
        "/api/orders",
        json=make_payload([
            {"book_id": book_id, "quantity": 1},
            {"book_id": book_id, "quantity": 2},
        ]),
    )
    assert response.status_code == 400
    assert response.get_json()["message"]
    assert count_orders(session_factory) == 0
    assert get_stock(session_factory, book_id) == 10


def test_invalid_json_body(client):
    response = client.post(
        "/api/orders", data="{not json", content_type="application/json"
    )
    assert response.status_code == 400
    assert response.get_json()["message"]


def test_no_body(client):
    response = client.post("/api/orders")
    assert response.status_code == 400
    assert response.get_json()["message"]


@pytest.mark.parametrize("body", [[], "text", 5, None])
def test_json_body_not_an_object(client, body):
    response = client.post("/api/orders", json=body)
    assert response.status_code == 400


def test_total_amount_overflow(client, session_factory):
    book_id = add_book(session_factory, price=2000000000, stock=10)
    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": book_id, "quantity": 2}]),
    )
    assert response.status_code == 400
    assert count_orders(session_factory) == 0
    assert get_stock(session_factory, book_id) == 10


# ---------- Nghiệp vụ: 404 và 409 ----------

def test_book_not_found(client, session_factory):
    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": 999, "quantity": 1}]),
    )
    assert response.status_code == 404
    assert response.get_json()["message"]
    assert count_orders(session_factory) == 0


def test_one_book_not_found_among_many_changes_nothing(client, session_factory):
    book_id = add_book(session_factory, stock=10)
    response = client.post(
        "/api/orders",
        json=make_payload([
            {"book_id": book_id, "quantity": 2},
            {"book_id": 999, "quantity": 1},
        ]),
    )
    assert response.status_code == 404
    assert count_orders(session_factory) == 0
    assert count_order_items(session_factory) == 0
    assert get_stock(session_factory, book_id) == 10


def test_insufficient_stock(client, session_factory):
    book_id = add_book(session_factory, stock=2)
    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": book_id, "quantity": 3}]),
    )
    assert response.status_code == 409
    assert response.get_json()["message"]
    assert count_orders(session_factory) == 0
    assert get_stock(session_factory, book_id) == 2


def test_out_of_stock_book(client, session_factory):
    book_id = add_book(session_factory, stock=0)
    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": book_id, "quantity": 1}]),
    )
    assert response.status_code == 409
    assert get_stock(session_factory, book_id) == 0


def test_one_item_insufficient_among_many_changes_nothing(client, session_factory):
    book_1 = add_book(session_factory, title="Sách 1", stock=10)
    book_2 = add_book(session_factory, title="Sách 2", stock=1)

    response = client.post(
        "/api/orders",
        json=make_payload([
            {"book_id": book_1, "quantity": 5},
            {"book_id": book_2, "quantity": 2},
        ]),
    )

    assert response.status_code == 409
    assert count_orders(session_factory) == 0
    assert count_order_items(session_factory) == 0
    assert get_stock(session_factory, book_1) == 10  # sách đủ hàng cũng không bị trừ
    assert get_stock(session_factory, book_2) == 1


def test_second_order_cannot_exceed_remaining_stock(client, session_factory):
    book_id = add_book(session_factory, stock=5)
    payload = make_payload([{"book_id": book_id, "quantity": 3}])

    assert client.post("/api/orders", json=payload).status_code == 201
    assert client.post("/api/orders", json=payload).status_code == 409

    assert get_stock(session_factory, book_id) == 2
    assert count_orders(session_factory) == 1


# ---------- Transaction và rollback ----------

def test_rollback_when_commit_fails(client, session_factory, monkeypatch):
    book_1 = add_book(session_factory, title="Sách 1", stock=10)
    book_2 = add_book(session_factory, title="Sách 2", stock=5)

    def broken_commit(self):
        raise SQLAlchemyError("lỗi giả lập khi commit: bí mật nội bộ")

    monkeypatch.setattr(Session, "commit", broken_commit)

    response = client.post(
        "/api/orders",
        json=make_payload([
            {"book_id": book_1, "quantity": 2},
            {"book_id": book_2, "quantity": 1},
        ]),
    )

    assert response.status_code == 500
    message = response.get_json()["message"]
    assert message
    assert "bí mật" not in message  # không lộ thông tin nội bộ
    assert "Traceback" not in response.get_data(as_text=True)

    monkeypatch.undo()
    assert count_orders(session_factory) == 0
    assert count_order_items(session_factory) == 0
    assert get_stock(session_factory, book_1) == 10
    assert get_stock(session_factory, book_2) == 5


def test_rollback_when_saving_order_fails(client, session_factory, monkeypatch):
    book_id = add_book(session_factory, stock=10)

    original_flush = Session.flush

    def broken_flush(self, *args, **kwargs):
        # Chỉ lỗi khi đang lưu Order mới; các lần autoflush khác vẫn chạy bình thường
        if self.new:
            raise SQLAlchemyError("lỗi giả lập khi lưu đơn: bí mật nội bộ")
        return original_flush(self, *args, **kwargs)

    monkeypatch.setattr(Session, "flush", broken_flush)

    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": book_id, "quantity": 4}]),
    )

    assert response.status_code == 500
    assert response.get_json()["message"]
    assert "bí mật" not in response.get_json()["message"]

    monkeypatch.undo()
    assert count_orders(session_factory) == 0
    assert count_order_items(session_factory) == 0
    assert get_stock(session_factory, book_id) == 10


def test_can_order_again_after_failed_order(client, session_factory, monkeypatch):
    """Sau khi rollback, session/database vẫn dùng bình thường."""
    book_id = add_book(session_factory, stock=10)
    payload = make_payload([{"book_id": book_id, "quantity": 1}])

    def broken_commit(self):
        raise SQLAlchemyError("lỗi giả lập")

    monkeypatch.setattr(Session, "commit", broken_commit)
    assert client.post("/api/orders", json=payload).status_code == 500
    monkeypatch.undo()

    assert client.post("/api/orders", json=payload).status_code == 201
    assert count_orders(session_factory) == 1
    assert get_stock(session_factory, book_id) == 9


# ---------- Cấu trúc response lỗi ----------

@pytest.mark.parametrize("payload, status", [
    ({"customer_name": ""}, 400),
    (make_payload([{"book_id": 999, "quantity": 1}]), 404),
])
def test_error_response_has_only_message(client, payload, status):
    response = client.post("/api/orders", json=payload)
    assert response.status_code == status
    body = response.get_json()
    assert set(body.keys()) == {"message"}
    assert isinstance(body["message"], str)


def test_insufficient_stock_response_has_only_message(client, session_factory):
    book_id = add_book(session_factory, stock=1)
    response = client.post(
        "/api/orders",
        json=make_payload([{"book_id": book_id, "quantity": 2}]),
    )
    assert response.status_code == 409
    assert set(response.get_json().keys()) == {"message"}