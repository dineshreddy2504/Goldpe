from fastapi import FastAPI, HTTPException
import json
import os
from urllib.request import Request, urlopen
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
import razorpay

# Load env
load_dotenv()

app = FastAPI()

# Environment variables
DATABASE_URL = os.getenv("DATABASE_URL")
GOLDAPI_API_KEY = os.getenv("GOLDAPI_API_KEY")
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_SECRET = os.getenv("RAZORPAY_SECRET")

# Razorpay client
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_SECRET))

# Database setup
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()

# Gold API
GOLDAPI_URL = "https://www.goldapi.io/api/XAU/INR"

LAST_KNOWN_PRICES = {
    "24k": 6000.0,
    "22k": 5500.0,
    "18k": 4500.0
}

# Database Tables
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

# CORS (for React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class TransactionCreate(BaseModel):
    name: str
    phone_no: str
    rate_id: str
    gold_amount: float
    buy_price: float
    client_reference_id: str
    order_id: str
    invoice_id: str
    status: int
    created_at: str

class OrderCreate(BaseModel):
    amount: float

class VerifyPayment(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

# Gold Price API
@app.get("/gold-price")
def get_gold_price():

    headers = {
        "x-access-token": GOLDAPI_API_KEY,
        "Content-Type": "application/json",
    }

    request = Request(GOLDAPI_URL, headers=headers)

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))

        price_24k = float(payload.get("price_gram_24k") or 0)
        price_22k = float(payload.get("price_gram_22k") or 0)
        price_18k = float(payload.get("price_gram_18k") or 0)

        if price_24k <= 0 and payload.get("price"):
            price_24k = float(payload["price"]) / 31.1034768

        if price_22k <= 0 and price_24k > 0:
            price_22k = price_24k * (22 / 24)

        if price_18k <= 0 and price_24k > 0:
            price_18k = price_24k * (18 / 24)

        if price_24k > 0:
            LAST_KNOWN_PRICES["24k"] = round(price_24k, 2)

        if price_22k > 0:
            LAST_KNOWN_PRICES["22k"] = round(price_22k, 2)

        if price_18k > 0:
            LAST_KNOWN_PRICES["18k"] = round(price_18k, 2)

        return {
            "24k": LAST_KNOWN_PRICES["24k"],
            "22k": LAST_KNOWN_PRICES["22k"],
            "18k": LAST_KNOWN_PRICES["18k"],
            "source": "goldapi",
        }

    except Exception:

        return {
            "24k": LAST_KNOWN_PRICES["24k"],
            "22k": LAST_KNOWN_PRICES["22k"],
            "18k": LAST_KNOWN_PRICES["18k"],
            "source": "fallback",
        }

# Razorpay Order Creation
@app.post("/create-order")
def create_order(data: OrderCreate):

    order = razorpay_client.order.create({
        "amount": int(data.amount * 100),
        "currency": "INR",
        "payment_capture": 1
    })

    return order

# Verify Razorpay Payment
@app.post("/verify-payment")
def verify_payment(data: VerifyPayment):

    try:

        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": data.razorpay_order_id,
            "razorpay_payment_id": data.razorpay_payment_id,
            "razorpay_signature": data.razorpay_signature
        })

        return {"status": "Payment verified"}

    except:

        raise HTTPException(status_code=400, detail="Payment verification failed")

# Save Transaction
@app.post("/transaction")
def create_transaction(data: TransactionCreate):

    db = SessionLocal()

    try:

        tx = Transaction(
            name=data.name,
            phone_no=data.phone_no,
            rate_id=data.rate_id,
            gold_amount=data.gold_amount,
            buy_price=data.buy_price,
            client_reference_id=data.client_reference_id,
            order_id=data.order_id,
            invoice_id=data.invoice_id,
            status=data.status,
            created_at=data.created_at,
        )

        db.add(tx)
        db.commit()

        balance = db.query(UserBalance).filter(
            UserBalance.phone_no == data.phone_no
        ).first()

        if balance:

            balance.gold_balance += data.gold_amount

        else:

            balance = UserBalance(
                phone_no=data.phone_no,
                gold_balance=data.gold_amount
            )

            db.add(balance)

        db.commit()

        return {"message": "Transaction saved"}

    finally:

        db.close()

# Get Transactions
@app.get("/transactions")
def get_transactions():

    db = SessionLocal()

    try:

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

    finally:

        db.close()

# Get User Gold Balance
@app.get("/balance/{phone}")
def get_balance(phone: str):

    db = SessionLocal()

    try:

        balance = db.query(UserBalance).filter(
            UserBalance.phone_no == phone
        ).first()

        if balance:

            return {"gold_balance": balance.gold_balance}

        return {"gold_balance": 0}

    finally:

        db.close()