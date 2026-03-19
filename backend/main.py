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
import logging

# ----------------------------
# Logging
# ----------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ----------------------------
# Load Environment Variables
# ----------------------------

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
GOLDAPI_API_KEY = os.getenv("GOLDAPI_API_KEY")
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_SECRET = os.getenv("RAZORPAY_SECRET")

if not DATABASE_URL:
    raise Exception("DATABASE_URL not set")

if not RAZORPAY_KEY_ID or not RAZORPAY_SECRET:
    raise Exception("Razorpay credentials not set in environment")

# ----------------------------
# FastAPI App
# ----------------------------

app = FastAPI()

# ----------------------------
# Razorpay Client
# ----------------------------

razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_SECRET))

# ----------------------------
# Database Setup
# ----------------------------

engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30
)

SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()

# ----------------------------
# Gold API
# ----------------------------

GOLDAPI_URL = "https://www.goldapi.io/api/XAU/INR"

LAST_KNOWN_PRICES = {
    "24k": 6000.0,
    "22k": 5500.0,
    "18k": 4500.0
}

# ----------------------------
# Database Tables
# ----------------------------

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    phone_no = Column(String(20), nullable=False)
    rate_id = Column(String(50), nullable=False)
    gold_amount = Column(Float, nullable=False)
    buy_price = Column(Float, nullable=False)
    client_reference_id = Column(String(100))
    order_id = Column(String(100))
    invoice_id = Column(String(100))
    status = Column(Integer, default=0)
    created_at = Column(String(50))


class UserBalance(Base):
    __tablename__ = "user_balances"

    id = Column(Integer, primary_key=True, index=True)
    phone_no = Column(String(20), unique=True, nullable=False, index=True)
    gold_balance = Column(Float, default=0)


Base.metadata.create_all(bind=engine)

# ----------------------------
# CORS
# ----------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,#Remove *
    allow_methods=["*"], 
    allow_headers=["*"],
)

# ----------------------------
# Request Models
# ----------------------------

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

# ----------------------------
# Gold Price API
# ----------------------------

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

        return LAST_KNOWN_PRICES

    except Exception as e:
        logger.warning(f"Gold API failed, using fallback: {str(e)}")
        return LAST_KNOWN_PRICES

# ----------------------------
# Razorpay Order Creation
# ----------------------------

@app.post("/create-order")
def create_order(data: OrderCreate):
    try:
        logger.info(f"Creating order for amount: {data.amount}")
        
        order = razorpay_client.order.create({
            "amount": int(data.amount * 100),
            "currency": "INR",
            "payment_capture": 1
        })
        
        logger.info(f"Order created successfully: {order.get('id')}")
        return order
    
    except Exception as e:
        logger.error(f"Order creation failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Order creation failed: {str(e)}")

# ----------------------------
# Razorpay Payment Verification
# ----------------------------

@app.post("/verify-payment")
def verify_payment(data: VerifyPayment):
    try:
        logger.info(f"Verifying payment: {data.razorpay_payment_id}")
        
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": data.razorpay_order_id,
            "razorpay_payment_id": data.razorpay_payment_id,
            "razorpay_signature": data.razorpay_signature
        })

        logger.info(f"Payment verified successfully: {data.razorpay_payment_id}")

        return {"status": "Payment verified", "success": True}

    except razorpay.BadRequestsError as e:
        logger.error(f"Razorpay BadRequestsError: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Payment verification failed: Bad request")
    
    except Exception as e:
        logger.error(f"Payment verification failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Payment verification failed: {str(e)}")

# ----------------------------
# Save Transaction
# ----------------------------

@app.post("/transaction")
def create_transaction(data: TransactionCreate):

    db = SessionLocal()

    try:

        tx = Transaction(**data.dict())
        db.add(tx)
        db.flush()

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

        logger.info(f"Transaction saved for {data.phone_no}")

        return {"message": "Transaction saved", "success": True}

    except Exception as e:

        db.rollback()

        logger.error(f"Transaction failed: {str(e)}")

        raise HTTPException(status_code=500, detail="Database error")

    finally:
        db.close()

# ----------------------------
# Get Transactions
# ----------------------------

@app.get("/transactions")
def get_transactions():

    db = SessionLocal()

    try:

        txs = db.query(Transaction).all()

        return txs

    finally:
        db.close()

# ----------------------------
# Get Balance
# ----------------------------

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