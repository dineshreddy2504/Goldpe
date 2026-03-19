import React, { useState, useEffect } from "react";
import "./App.css";

const API = process.env.REACT_APP_API_URL;

console.log("React App API URL:", API);

function App() {
    const [goldPrice, setGoldPrice] = useState({
        k24: 0,
        k22: 0,
        k18: 0
    });

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [amount, setAmount] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    const goldWeight = goldPrice.k24 > 0 ? amount / goldPrice.k24 : 0;

    const price1g = goldPrice.k24;
    const price8g = goldPrice.k24 * 8;
    const price10g = goldPrice.k24 * 10;
    const price100g = goldPrice.k24 * 100;

    const fetchGoldPrice = async () => {
        try {
            console.log("Fetching gold price from:", `${API}/gold-price`);
            const res = await fetch(`${API}/gold-price`);
            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }
            const data = await res.json();
            console.log("Gold price data received:", data);
            setGoldPrice({
                k24: Number(data["24k"]) || 0,
                k22: Number(data["22k"]) || 0,
                k18: Number(data["18k"]) || 0
            });
            setError("");
        } catch (error) {
            console.error("Gold price error:", error);
            console.error("API URL was:", `${API}/gold-price`);
            setError("Failed to fetch gold prices. Showing fallback prices.");
            // Set fallback prices
            setGoldPrice({
                k24: 15000,
                k22: 13750,
                k18: 11250
            });
        }
    };

    const fetchTransactions = async () => {
        try {
            const res = await fetch(`${API}/transactions`);
            const data = await res.json();
            setTransactions(data);
        } catch (error) {
            console.error("Transaction error:", error);
        }
    };

    useEffect(() => {
        fetchGoldPrice();
        fetchTransactions();
        const interval = setInterval(fetchGoldPrice, 420000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // SAVE TRANSACTION
    const buyGold = async (orderId) => {
        const invoiceId = "INV" + Math.floor(Math.random() * 1000000);
        const clientReferenceId = "REF" + Math.floor(Math.random() * 1000000);

        const numericAmount = Number(amount);
        const gst = numericAmount * 0.03;
        const total = numericAmount + gst;

        const transaction = {
            name: name,
            phone_no: phone,
            rate_id: "RATE123",
            gold_amount: Number(goldWeight.toFixed(4)),
            buy_price: Number(total.toFixed(2)),
            client_reference_id: clientReferenceId,
            order_id: orderId,
            invoice_id: invoiceId,
            status: 1,
            created_at: new Date().toISOString()
        };

        await fetch(`${API}/transaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(transaction)
        });

        setInvoice({
            orderId,
            invoiceId,
            gold: goldWeight.toFixed(4),
            amount: numericAmount,
            gst: gst.toFixed(2),
            total: total.toFixed(2),
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });

        fetchTransactions();
        setName("");
        setPhone("");
        setAmount(0);
        setLoading(false);
    };

    const startPayment = async () => {
        setError("");
        if (!/^[0-9]{10}$/.test(phone)) {
            setError("Enter a valid 10-digit phone number");
            return;
        }
        if (!name || !phone || !amount || amount <= 0) {
            setError("Please fill all fields with valid values");
            return;
        }
        setLoading(true);
        try {
            const numericAmount = Number(amount);
            const gst = numericAmount * 0.03;
            const totalAmount = numericAmount + gst;

            const orderRes = await fetch(`${API}/create-order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: totalAmount
                })
            });
            const order = await orderRes.json();
            console.log("Order:", order);

            const options = {
                key: process.env.REACT_APP_RAZORPAY_KEY,
                amount: order.amount,
                currency: "INR",
                name: "GoldPe",
                description: "Buy Digital Gold",
                order_id: order.id,
                handler: async function (response) {
                    try {
                        const verifyRes = await fetch(`${API}/verify-payment`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature
                            })
                        });

                        const verifyData = await verifyRes.json();
                        
                        if (!verifyRes.ok || !verifyData.success) {
                            setError("Payment verification failed. Please contact support.");
                            setLoading(false);
                            return;
                        }

                        alert("Payment Successful!");
                        await buyGold(order.id);
                    } catch (error) {
                        console.error("Verification error:", error);
                        setError("Payment verification error. Please contact support.");
                        setLoading(false);
                    }
                },
                prefill: {
                    name: name,
                    contact: phone
                },
                theme: {
                    color: "#f4b400"
                },
                modal: {
                    ondismiss: function() {
                        console.log("Payment Modal Closed");
                        setLoading(false);
                    }
                },
                onerror: function(error) {
                    console.error("Razorpay Error:", error);
                    setError(`Payment Error: ${error.code} - ${error.description}`);
                    setLoading(false);
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error) {
            console.error("Payment error:", error);
            setError("Payment failed. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="App">
            {/* HEADER */}
            <div className="header">
                <div className="header-content">
                    <div className="logo">GoldPe</div>
                    <div className="datetime">
                        {currentDateTime.toLocaleDateString('en-GB')} {currentDateTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            {/* INVOICE MODAL */}
            {invoice && (
                <div className="invoice-section">
                    <div>
                        <div className="invoice-header">
                            <h2>✓ Payment Successful</h2>
                            <p>Your gold purchase has been confirmed</p>
                        </div>
                        <div className="invoice-details">
                            <div className="invoice-row">
                                <label>Date & Time</label>
                                <value>{invoice.date} {invoice.time}</value>
                            </div>
                            <div className="invoice-row">
                                <label>Order ID</label>
                                <value>{invoice.orderId}</value>
                            </div>
                            <div className="invoice-row">
                                <label>Invoice ID</label>
                                <value>{invoice.invoiceId}</value>
                            </div>
                            <div className="invoice-row">
                                <label>Gold Purchased</label>
                                <value>{invoice.gold} g</value>
                            </div>
                            <div className="invoice-row">
                                <label>Amount</label>
                                <value>₹{invoice.amount}</value>
                            </div>
                            <div className="invoice-row">
                                <label>GST (3%)</label>
                                <value>₹{invoice.gst}</value>
                            </div>
                            <div className="invoice-row" style={{fontWeight: 700, fontSize: '1.1rem', borderTop: '2px solid #d4af37'}}>
                                <label>Total Paid</label>
                                <value>₹{invoice.total}</value>
                            </div>
                        </div>
                        <div className="invoice-actions">
                            <button className="close-invoice-btn" onClick={() => setInvoice(null)}>
                                ← Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN CONTAINER */}
            <div className="container">
                {/* HERO */}
                <div className="hero">
                    <h1>Buy Digital Gold</h1>
                    <p>Invest in gold instantly at live market prices</p>
                </div>

                {/* PRICE SECTION */}
                <div className="price-section">
                    <div className="price-card">
                        <h3>24K Gold</h3>
                        <div className="price-value">₹{goldPrice.k24.toFixed(0)}</div>
                        <div className="price-unit">per gram</div>
                    </div>
                    <div className="price-card">
                        <h3>22K Gold</h3>
                        <div className="price-value">₹{goldPrice.k22.toFixed(0)}</div>
                        <div className="price-unit">per gram</div>
                    </div>
                    <div className="price-card">
                        <h3>18K Gold</h3>
                        <div className="price-value">₹{goldPrice.k18.toFixed(0)}</div>
                        <div className="price-unit">per gram</div>
                    </div>
                </div>

                {/* QUICK BUY */}
                <div className="quick-buy">
                    <h2>Quick Buy Options</h2>
                    <div className="quick-buy-buttons">
                        <button className="quick-buy-btn" onClick={() => setAmount(price1g)}>
                            1g: ₹{price1g.toFixed(0)}
                        </button>
                        <button className="quick-buy-btn" onClick={() => setAmount(price8g)}>
                            8g: ₹{price8g.toFixed(0)}
                        </button>
                        <button className="quick-buy-btn" onClick={() => setAmount(price10g)}>
                            10g: ₹{price10g.toFixed(0)}
                        </button>
                        <button className="quick-buy-btn" onClick={() => setAmount(price100g)}>
                            100g: ₹{price100g.toFixed(0)}
                        </button>
                    </div>
                </div>

                {/* CURRENT GOLD PRICE */}
                <div className="current-price-section">
                    <div className="current-price-box">
                        <div className="current-price-label">Current  Gold Price</div>
                        <div className="current-price-value">₹{goldPrice.k24.toFixed(2)}</div>
                        <div className="current-price-unit">per gram</div>
                    </div>
                </div>

                {/* FORM SECTION */}
                <div className="form-section">
                    <h2>Purchase Form</h2>
                    
                    {error && <div className="error-message">⚠️ {error}</div>}

                    <div className="form-group">
                        <label>Full Name</label>
                        <input
                            type="text"
                            placeholder="Enter your full name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label>Phone Number</label>
                        <input
                            type="tel"
                            placeholder="10-digit mobile number"
                            value={phone}
                            maxLength="10"
                            onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, "");
                                setPhone(value);
                            }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Amount (₹)</label>
                        <input
                            type="number"
                            placeholder="Enter investment amount"
                            value={amount || ''}
                            onChange={(e) => setAmount(Number(e.target.value) || 0)}
                        />
                    </div>

                    <div className="price-info">
                        <div className="price-info-row">
                            <span className="price-info-label">Gold Weight:</span>
                            <span className="price-info-value">{goldWeight.toFixed(4)} g</span>
                        </div>
                        <div className="price-info-row">
                            <span className="price-info-label">Amount:</span>
                            <span className="price-info-value">₹{amount.toFixed(2)}</span>
                        </div>
                        <div className="price-info-row">
                            <span className="price-info-label">GST (3%):</span>
                            <span className="price-info-value">₹{(amount * 0.03).toFixed(2)}</span>
                        </div>
                        <div className="price-info-row">
                            <span className="price-info-label">Total:</span>
                            <span className="price-info-value">₹{(amount + amount * 0.03).toFixed(2)}</span>
                        </div>
                    </div>

                    <button
                        className="submit-btn"
                        onClick={startPayment}
                        disabled={!goldPrice.k24 || loading}
                    >
                        {loading ? "⏳ Processing..." : "✓ Proceed to Payment"}
                    </button>
                </div>

                {/* TRANSACTIONS TABLE */}
                {transactions.length > 0 && (
                    <div className="transactions-section">
                        <h2>Your Transactions</h2>
                        <table className="transactions-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Gold (g)</th>
                                    <th>Amount (₹)</th>
                                    <th>Invoice ID</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx, idx) => (
                                    <tr key={idx}>
                                        <td>{tx.name}</td>
                                        <td>{Number(tx.gold_amount).toFixed(4)}</td>
                                        <td>₹{Number(tx.buy_price).toFixed(2)}</td>
                                        <td>{tx.invoice_id}</td>
                                        <td>{new Date(tx.created_at).toLocaleDateString('en-GB')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
