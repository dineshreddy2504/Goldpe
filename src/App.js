import React, { useState, useEffect } from "react";

const API = process.env.REACT_APP_API_URL;

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

    const goldWeight = goldPrice.k24 > 0 ? amount / goldPrice.k24 : 0;

    const price1g = goldPrice.k24;
    const price8g = goldPrice.k24 * 8;
    const price10g = goldPrice.k24 * 10;
    const price100g = goldPrice.k24 * 100;

    const fetchGoldPrice = async () => {

        try {

            const res = await fetch(`${API}/gold-price`);
            const data = await res.json();

            setGoldPrice({
                k24: Number(data["24k"]),
                k22: Number(data["22k"]),
                k18: Number(data["18k"])
            });

        } catch (error) {

            console.error("Gold price error:", error);

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
            total: total.toFixed(2)
        });

        fetchTransactions();

        setName("");
        setPhone("");
        setAmount(0);

    };


    // // START PAYMENT
    // const startPayment = async () => {

    //     if (!/^[0-9]{10}$/.test(phone)) {
    //         alert("Enter valid 10 digit phone number");
    //         return;
    //     }

    //     if (!name || !phone || !amount) {
    //         alert("Please fill all fields");
    //         return;
    //     }

    //     const numericAmount = Number(amount);

    //     // CREATE ORDER
    //     const orderRes = await fetch(`${API}/create-order`, {
    //         method: "POST",
    //         headers: {
    //             "Content-Type": "application/json"
    //         },
    //         body: JSON.stringify({
    //             amount: numericAmount
    //         })
    //     });

    //     const order = await orderRes.json();

    //     const options = {

    //         key: process.env.REACT_APP_RAZORPAY_KEY,

    //         amount: order.amount,

    //         currency: "INR",

    //         name: "GoldPe",

    //         description: "Buy Digital Gold",

    //         order_id: order.id,

    //         handler: async function (response) {

    //             await fetch(`${API}/verify-payment`, {

    //                 method: "POST",

    //                 headers: {
    //                     "Content-Type": "application/json"
    //                 },

    //                 body: JSON.stringify({
    //                     razorpay_order_id: response.razorpay_order_id,
    //                     razorpay_payment_id: response.razorpay_payment_id,
    //                     razorpay_signature: response.razorpay_signature
    //                 })

    //             });

    //             alert("Payment Successful!");

    //             buyGold(order.id);

    //         },

    //         prefill: {
    //             name: name,
    //             contact: phone
    //         },

    //         theme: {
    //             color: "#f4b400"
    //         }

    //     };

    //     const rzp = new window.Razorpay(options);

    //     rzp.open();

    // };
    const startPayment = async () => {

        if (!/^[0-9]{10}$/.test(phone)) {
            alert("Enter valid 10 digit phone number");
            return;
        }

        if (!name || !phone || !amount) {
            alert("Please fill all fields");
            return;
        }

        try {

            const orderRes = await fetch(`${API}/create-order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: Number(amount)
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

                    await fetch(`${API}/verify-payment`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });

                    alert("Payment Successful!");

                    buyGold(order.id);
                },

                prefill: {
                    name: name,
                    contact: phone
                },

                theme: {
                    color: "#f4b400"
                }

            };

            const rzp = new window.Razorpay(options);

            rzp.open();

        } catch (error) {

            console.error("Payment error:", error);

        }

    };


    // PORTFOLIO
    const totalGold = transactions.reduce(
        (sum, tx) => sum + Number(tx.gold_amount),
        0
    );

    const totalInvested = transactions.reduce(
        (sum, tx) => sum + Number(tx.buy_price),
        0
    );

    const totalOrders = transactions.length;


    return (

        <div style={styles.page}>

            {invoice && (

                <div style={styles.invoice}>

                    <h2>Payment Successful</h2>

                    <p><b>Order ID:</b> {invoice.orderId}</p>
                    <p><b>Invoice ID:</b> {invoice.invoiceId}</p>
                    <p><b>Gold Purchased:</b> {invoice.gold} g</p>
                    <p><b>Amount:</b> ₹{invoice.amount}</p>
                    <p><b>GST:</b> ₹{invoice.gst}</p>
                    <p><b>Total Paid:</b> ₹{invoice.total}</p>

                    <button onClick={() => setInvoice(null)} style={styles.closeBtn}>
                        Close
                    </button>

                </div>

            )}

            <div style={styles.header}>

                <h1 style={styles.logo}>GoldPe</h1>

                <p style={styles.tagline}>
                    Buy digital gold instantly at live market prices.
                </p>

            </div>

            <div style={styles.portfolio}>

                <div style={styles.portfolioItem}>
                    <p>Total Gold</p>
                    <h3>{totalGold.toFixed(4)} g</h3>
                </div>

                <div style={styles.portfolioItem}>
                    <p>Total Invested</p>
                    <h3>₹{totalInvested.toFixed(2)}</h3>
                </div>

                <div style={styles.portfolioItem}>
                    <p>Total Purchases</p>
                    <h3>{totalOrders}</h3>
                </div>

            </div>

            <h2>Gold Purity Prices</h2>

            <table border="1">

                <thead>
                    <tr>
                        <th>Gold Type</th>
                        <th>Price / gram</th>
                    </tr>
                </thead>

                <tbody>

                    <tr>
                        <td>24K Gold</td>
                        <td>₹{goldPrice.k24}</td>
                    </tr>

                    <tr>
                        <td>22K Gold</td>
                        <td>₹{goldPrice.k22}</td>
                    </tr>

                    <tr>
                        <td>18K Gold</td>
                        <td>₹{goldPrice.k18}</td>
                    </tr>

                </tbody>

            </table>

            <div style={styles.card}>

                <h2>Live Gold Price</h2>

                <h3 style={styles.price}>
                    {goldPrice.k24 > 0 ? `₹${goldPrice.k24} / gram` : "Fetching price..."}
                </h3>

                <input
                    style={styles.input}
                    placeholder="Enter Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />

                <input
                    style={styles.input}
                    type="tel"
                    placeholder="Phone Number"
                    value={phone}
                    maxLength="10"
                    onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        setPhone(value);
                    }}
                />

                <input
                    style={styles.input}
                    type="number"
                    placeholder="Enter Amount (₹)"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                />

                <div style={styles.summary}>
                    <p>Gold Weight</p>
                    <h2>{goldWeight.toFixed(4)} g</h2>
                </div>

                <button
                    style={styles.button}
                    onClick={startPayment}
                    disabled={!goldPrice.k24}
                >

                    Pay & Buy Gold

                </button>

            </div>

        </div>

    );

}


const styles = {

    page: {
        background: "#f5f6fa",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "Arial",
        paddingTop: "40px"
    },

    header: {
        textAlign: "center",
        marginBottom: "30px"
    },

    logo: {
        fontSize: "42px",
        color: "#e1a500"
    },

    tagline: {
        color: "#555"
    },

    portfolio: {
        display: "flex",
        gap: "20px",
        marginBottom: "30px"
    },

    portfolioItem: {
        background: "#fff",
        padding: "15px",
        borderRadius: "10px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
        textAlign: "center",
        width: "120px"
    },

    invoice: {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
        background: "#fff",
        padding: "30px",
        borderRadius: "10px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        textAlign: "center",
        width: "300px"
    },

    closeBtn: {
        marginTop: "15px",
        padding: "8px 16px",
        border: "none",
        background: "#f4b400",
        borderRadius: "6px",
        cursor: "pointer"
    },

    card: {
        background: "#fff",
        padding: "40px",
        borderRadius: "10px",
        boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
        width: "350px",
        textAlign: "center"
    },

    price: {
        color: "#e1a500",
        marginBottom: "20px"
    },

    input: {
        width: "100%",
        padding: "12px",
        margin: "10px 0",
        borderRadius: "6px",
        border: "1px solid #ddd"
    },

    summary: {
        marginTop: "20px",
        marginBottom: "20px"
    },

    button: {
        width: "100%",
        padding: "12px",
        background: "#f4b400",
        border: "none",
        borderRadius: "6px",
        fontSize: "16px",
        fontWeight: "bold",
        cursor: "pointer"
    }

};

export default App;