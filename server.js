require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");

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

// Verify Payment
app.post("/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated_signature === razorpay_signature) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});
const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>
  console.log("Server running on port " + PORT)
);
