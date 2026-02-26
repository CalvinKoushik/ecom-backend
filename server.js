require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const axios = require("axios");

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://iot-haven.vercel.app"
  ],
  methods: ["GET", "POST"],
}));

app.use(express.json());

/* -------------------- Razorpay -------------------- */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* -------------------- Shiprocket -------------------- */

let shiprocketToken = null;
let tokenExpiry = null;

async function getShiprocketToken() {
  if (shiprocketToken && tokenExpiry > Date.now()) {
    return shiprocketToken;
  }

  const response = await axios.post(
    "https://apiv2.shiprocket.in/v1/external/auth/login",
    {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }
  );

  shiprocketToken = response.data.token;
  tokenExpiry = Date.now() + 8 * 60 * 60 * 1000; // 8 hours

  return shiprocketToken;
}

async function createShiprocketOrder(orderData) {
  const token = await getShiprocketToken();

  const response = await axios.post(
    "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
    orderData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

/* -------------------- Routes -------------------- */

app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    });

    res.json(order);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

/* 🔥 SINGLE SECURE CHECKOUT ROUTE */

app.post("/checkout", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderDetails,
      paymentMethod
    } = req.body;

    /* 1️⃣ Verify Razorpay Signature */
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    console.log("✅ Payment Verified");

    /* 2️⃣ Create Shipment */
    const shiprocketPayload = {
      order_id: orderDetails.order_number,
      order_date: new Date().toISOString().split("T")[0],
      pickup_location: "Primary",

      billing_customer_name: orderDetails.full_name,
      billing_address: orderDetails.address_line,
      billing_city: orderDetails.city,
      billing_pincode: orderDetails.pincode,
      billing_state: orderDetails.state,
      billing_country: "India",
      billing_email: orderDetails.email,
      billing_phone: orderDetails.phone,

      shipping_is_billing: true,
      order_items: orderDetails.items,

      payment_method: paymentMethod === "cod" ? "COD" : "Prepaid",
      sub_total: orderDetails.total,

      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5,
    };

    const shipment = await createShiprocketOrder(shiprocketPayload);

    console.log("🚀 Shipment Created");

    return res.json({
      success: true,
      shipment
    });

  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ success: false, message: "Checkout failed" });
  }
});

app.get("/", (req, res) => {
  res.json({ status: "Backend running 🚀" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));