from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker

app = FastAPI()

# Database setup
DATABASE_URL = "sqlite:///./goldpe.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()


# Transaction Table
class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    phone_no = Column(String)
    rate_id = Column(String)
    gold_amount = Column(Float)
    buy_price = Column(Float)
    client_reference_id = Column(String)
    order_id = Column(String)
    invoice_id = Column(String)
    status = Column(Integer)
    created_at = Column(String)


class UserBalance(Base):
    __tablename__ = "user_balances"

    id = Column(Integer, primary_key=True, index=True)
    phone_no = Column(String, unique=True)
    gold_balance = Column(Float, default=0)


Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/gold-price")
def get_gold_price():
    return {"price": 6000}


@app.post("/transaction")
def create_transaction(data: dict):
    db = SessionLocal()

    tx = Transaction(
        name=data["name"],
        phone_no=data["phone_no"],
        rate_id=data["rate_id"],
        gold_amount=float(data["gold_amount"]),
        buy_price=float(data["buy_price"]),
        client_reference_id=data["client_reference_id"],
        order_id=data["order_id"],
        invoice_id=data["invoice_id"],
        status=data["status"],
        created_at=data["created_at"],
    )

    db.add(tx)
    db.commit()

    balance = db.query(UserBalance).filter(
        UserBalance.phone_no == data["phone_no"]
    ).first()

    if balance:
        balance.gold_balance += float(data["gold_amount"])
    else:
        balance = UserBalance(
            phone_no=data["phone_no"],
            gold_balance=float(data["gold_amount"]),
        )
        db.add(balance)

    db.commit()

    return {"message": "Transaction saved in database"}


@app.get("/transactions")
def get_transactions():
    db = SessionLocal()

    txs = db.query(Transaction).all()

    return [
        {
            "name": t.name,
            "phone_no": t.phone_no,
            "gold_amount": t.gold_amount,
            "buy_price": t.buy_price,
            "order_id": t.order_id,
            "invoice_id": t.invoice_id,
            "status": t.status,
        }
        for t in txs
    ]


@app.get("/balance/{phone}")
def get_balance(phone: str):
    db = SessionLocal()

    balance = db.query(UserBalance).filter(
        UserBalance.phone_no == phone
    ).first()

    if balance:
        return {"gold_balance": balance.gold_balance}

    return {"gold_balance": 0}
