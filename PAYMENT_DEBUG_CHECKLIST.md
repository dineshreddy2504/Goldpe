# Razorpay Payment Debugging Checklist

## Issues Fixed ✅

1. **Added Error Handling to Razorpay Modal** - The payment modal now catches errors properly with `onerror` and `ondismiss` callbacks
2. **Fixed Payment Verification Flow** - The frontend now waits for payment verification to complete before proceeding
3. **Added Response Validation** - The frontend checks if verification was successful before showing success message
4. **Improved Backend Error Logging** - Better logging in order creation and payment verification endpoints

## How to Debug Payment Issues

### Step 1: Check Browser Console
When you click "Proceed to Payment", open DevTools (F12) and check for errors:
- Look for any CORS issues
- Check if Razorpay script loaded: `typeof Razorpay !== 'undefined'`
- Look for network errors to `/create-order` or `/verify-payment`

Run in console:
```javascript
// Check if Razorpay is loaded
console.log(typeof Razorpay);

// Check environment variable
console.log(process.env.REACT_APP_RAZORPAY_KEY);

// Check API URL
console.log(process.env.REACT_APP_API_URL);
```

### Step 2: Check Backend Logs
The backend now logs detailed information:
- "Creating order for amount: X" - when order is created
- "Order created successfully: order_id" - confirms order creation
- "Verifying payment: payment_id" - when verification starts
- "Payment verified successfully" - confirms verification passed

Monitor the terminal where you run: `python -m uvicorn main:app --reload`

### Step 3: Test the Complete Flow

#### Test Case 1: Order Creation
```bash
# Test from backend terminal
curl -X POST http://127.0.0.1:8000/create-order \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000}'
```

Expected response:
```json
{
  "id": "order_...",
  "amount": 100000,
  "status": "created",
  ...
}
```

#### Test Case 2: Verify Environment Variables
```bash
# Windows PowerShell - in backend folder
$env:RAZORPAY_KEY_ID
$env:RAZORPAY_SECRET

# Should show your keys from .env
```

### Step 4: Common Issues & Solutions

#### Issue: "Payment Error: SOMETHING_WENT_WRONG"
- **Cause**: Razorpay key not loaded properly
- **Fix**: Ensure `.env` file has correct `REACT_APP_RAZORPAY_KEY`
- **Verify**: Check browser console for the key: `process.env.REACT_APP_RAZORPAY_KEY`

#### Issue: "Payment verification failed"
- **Cause**: Mismatch in Razorpay keys between frontend and backend
- **Fix**: Ensure both use same test/live keys
- **Check**: Frontend uses `REACT_APP_RAZORPAY_KEY` (public key)
- **Check**: Backend uses `RAZORPAY_KEY_ID` and `RAZORPAY_SECRET` from same Razorpay account

#### Issue: CORS errors
- **Cause**: Frontend can't reach backend
- **Fix**: Verify `REACT_APP_API_URL=http://127.0.0.1:8000` is correct
- **Fix**: Backend must be running when frontend tries to call it

#### Issue: Modal doesn't open at all
- **Cause**: Razorpay checkout.js not loaded
- **Fix**: Check `public/index.html` has: `<script src="https://checkout.razorpay.com/v1/checkout.js"></script>`
- **Verify**: In DevTools, search for "checkout" in Network tab

### Step 5: Restart Everything (Important!)

After making changes, restart:
1. **Frontend**: Stop npm and run `npm start` again
2. **Backend**: Stop uvicorn and run `python -m uvicorn main:app --reload` again
3. **Clear browser cache**: Hard refresh (Ctrl+F5)

## Test with Real Payment (Optional)

Razorpay Test Credentials:
- **Test Card**: 4111 1111 1111 1111
- **Expiry**: Any future date (e.g., 12/25)
- **CVV**: Any 3 digits (e.g., 123)
- **Name**: Any name

## Still Having Issues?

1. Share the exact error message from browser console
2. Check backend terminal for error logs
3. Verify all environment variables are set correctly
4. Make sure both frontend and backend servers are running
