const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();

// ✅ Allow frontend on recovervaultpro.online to access this backend
app.use(
  cors({
    origin: "https://recovervaultpro.online",
    credentials: true,
  })
);

app.use(express.json());

// ✅ If serving frontend (optional)
// app.use(express.static(path.join(__dirname, "public")));

// ✅ Route: Create payment with NowPayments
app.post("/api/create-payment", async (req, res) => {
  const { price_amount, order_description, name, email, phone, type, details } =
    req.body;

  try {
    const response = await axios.post(
      "https://api.nowpayments.io/v1/invoice",
      {
        price_amount,
        price_currency: "usd",
        pay_currency: "btc",
        order_description,
        ipn_callback_url:
          "https://recovervault-backend.onrender.com/api/payment-callback", // 👈 Use your Render backend URL here
        success_url: "https://recovervaultpro.online/success",
        cancel_url: "https://recovervaultpro.online/failure",
      },
      {
        headers: {
          "x-api-key": process.env.NOWPAYMENTS_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ invoice_url: response.data.invoice_url });
  } catch (error) {
    console.error("NOWPayments error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

// ✅ Route: Handle callback from NowPayments after payment
app.post("/api/payment-callback", async (req, res) => {
  const data = req.body;

  const isSuccess = data.payment_status === "finished";
  const userEmail = data.order_description.split("||")[0];

  const messageText = isSuccess
    ? `✅ Payment Successful\nAmount: $${data.price_amount}\nPayment ID: ${data.payment_id}`
    : `❌ Payment Failed\nDetails: ${JSON.stringify(data)}`;

  const emailData = {
    access_key: process.env.ACCESS_KEY,
    subject: isSuccess ? "Payment Successful" : "Payment Failed",
    from_name: "RecoverVault",
    email: userEmail,
    message: messageText,
  };

  const adminEmailData = {
    ...emailData,
    email: process.env.ADMIN_EMAIL,
    message: `[ADMIN COPY]\n\n${messageText}`,
  };

  try {
    await axios.post(process.env.EMAIL_WEBHOOK, emailData);
    await axios.post(process.env.EMAIL_WEBHOOK, adminEmailData);
    res.sendStatus(200);
  } catch (err) {
    console.error("Email sending failed:", err.message);
    res.sendStatus(500);
  }
});

// ✅ Optional fallback route (only if frontend served together)
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

// ✅ Use the port provided by Render (or fallback for local dev)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
