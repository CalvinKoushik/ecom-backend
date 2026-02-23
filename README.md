# E-Commerce Backend API

Node.js + Express backend for handling Razorpay payments and order verification.

## 🚀 Tech Stack

- Node.js
- Express.js
- Razorpay
- CORS
- Crypto (HMAC verification)
- Render (Deployment)

---

## 📦 Features

- Create Razorpay Order
- Verify Razorpay Payment Signature
- CORS enabled for frontend
- Environment-based configuration

---

## 🔐 Environment Variables

Create a `.env` file in the root:

RAZORPAY_KEY_ID=your_key_id  
RAZORPAY_KEY_SECRET=your_key_secret  
PORT=5000

⚠️ Never commit `.env` to GitHub.

---

## 🛠 Installation

```bash
npm install
