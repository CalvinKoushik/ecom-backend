require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const axios = require("axios");

let shiprocketToken = null;

async function getShiprocketToken() {
  if (shiprocketToken) return shiprocketToken;

  const response = await axios.post(
    "https://apiv2.shiprocket.in/v1/external/auth/login",
    {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }
  );

  shiprocketToken = response.data.token;
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

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://iot-haven.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Order
app.post("/create-order", async (req, res) => {
  console.log("Create Order Request Body:", req.body);
  try {
    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    });

    console.log("Order Created Successfully:", order);
    res.json(order);
  } catch (err) {
    console.error("Razorpay Order Creation Error:", err);
    res.status(500).json({ error: err.error ? err.error.description : "Internal Server Error", details: err });
  }
});
app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderDetails,
    } = req.body;

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.json({ success: false });
    }

    console.log("✅ Payment Verified");

    // 🔥 Prepare Shiprocket Order Payload
    const shiprocketPayload = {
      order_id: orderDetails.order_number,
      order_date: new Date().toISOString().split("T")[0],
      pickup_location: "Primary",
      comment: "Order from IoT Haven",

      billing_customer_name: orderDetails.full_name,
      billing_last_name: "",
      billing_address: orderDetails.address_line,
      billing_city: orderDetails.city,
      billing_pincode: orderDetails.pincode,
      billing_state: orderDetails.state,
      billing_country: "India",
      billing_email: orderDetails.email,
      billing_phone: orderDetails.phone,

      shipping_is_billing: true,

      order_items: orderDetails.items,

      payment_method: "Prepaid",
      sub_total: orderDetails.total,

      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5,
    };

    const shiprocketResponse = await createShiprocketOrder(shiprocketPayload);

    console.log("🚀 Shiprocket Order Created:", shiprocketResponse);

    res.json({
      success: true,
      shiprocket: shiprocketResponse,
    });

  } catch (err) {
    console.error("Verify Payment Error:", err.response?.data || err);
    res.status(500).json({ error: "Server Error" });
  }
});