app.post("/checkout", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderDetails,
      paymentMethod
    } = req.body;

    /* 🔐 1️⃣ Verify Razorpay only if prepaid */
    if (paymentMethod === "prepaid") {

      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: "Invalid signature"
        });
      }

      console.log("✅ Payment Verified");
    }

    /* 🚀 2️⃣ Create Shipment (For BOTH COD & Prepaid) */
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
    res.status(500).json({
      success: false,
      message: "Checkout failed"
    });
  }
});