import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "SECRETKEY";

app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "oindex.html"));
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "register.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

/* ===== MongoDB ===== */

mongoose.set("strictQuery", true);

mongoose.connect("mongodb://127.0.0.1:27017/cartverse")
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => {
        console.error("MongoDB connection failed:", err.message);
    });

/* ===== Schemas ===== */

const userSchema = new mongoose.Schema({
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    gender: { type: String, default: "" },
    address: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    productName: { type: String, required: true },
    productPrice: { type: Number, required: true },
    bookingType: { type: String, enum: ["buy", "rent"], default: "buy" },
    rentalDays: { type: Number, default: 0 },
    deliveryAddress: { type: String, required: true },
    paymentMethod: { type: String, default: "cash" },
    totalPrice: { type: Number, required: true },
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Order = mongoose.model("Order", orderSchema);

/* ===== OTP Store ===== */

let otpStore = {};

/* ===== Email Config ===== */

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER || "deveshsingh.8865@gmail.com",
        pass: process.env.EMAIL_PASS || "tpevwhcqlcgbgpmt"
    }
});

/* ===== Helpers ===== */

const generateToken = (user) => jwt.sign(
    { id: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
);

const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.headers.token;

    if (!token) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};

/* ===== Health ===== */

app.get("/health", (req, res) => {
    res.json({ success: true, message: "Server is running", timestamp: new Date().toISOString() });
});

/* ===== Send OTP ===== */

app.post("/send-otp", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.json({ success: false, message: "Email is required" });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const otp = Math.floor(1000 + Math.random() * 9000);

        otpStore[normalizedEmail] = String(otp);

        await transporter.sendMail({
            from: "Cart-Verse <deveshsingh.8865@gmail.com>",
            to: normalizedEmail,
            subject: "Cart-Verse OTP",
            text: `Your OTP is ${otp}`
        });

        console.log("OTP SENT:", otp, "for", normalizedEmail);
        res.json({ success: true, message: "OTP sent successfully ✅" });
    } catch (error) {
        console.error("EMAIL ERROR:", error);
        res.json({ success: false, message: "Email failed. Please try again." });
    }
});

/* ===== Verify OTP + Register ===== */

app.post("/verify-otp", async (req, res) => {
    try {
        const { email, password, otp, gender, address, firstName, lastName } = req.body;

        if (!email || !password || !otp || !gender || !address) {
            return res.json({ success: false, message: "Please fill all required fields" });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        if (otpStore[normalizedEmail] !== String(otp)) {
            return res.json({ success: false, message: "Invalid OTP ❌" });
        }

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            delete otpStore[normalizedEmail];
            return res.json({ success: false, message: "User already exists. Please login." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            firstName: firstName || "",
            lastName: lastName || "",
            email: normalizedEmail,
            password: hashedPassword,
            gender,
            address
        });

        delete otpStore[normalizedEmail];

        res.json({
            success: true,
            message: "Registered Successfully ✅",
            token: generateToken(user)
        });
    } catch (error) {
        console.error("REGISTER ERROR:", error);
        res.json({ success: false, message: "Registration failed ❌" });
    }
});

/* ===== Login ===== */

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.json({ success: false, message: "Email and password are required" });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: "Wrong Password" });
        }

        res.json({
            success: true,
            token: generateToken(user),
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                gender: user.gender
            }
        });
    } catch (error) {
        console.error("LOGIN ERROR:", error);
        res.json({ success: false, message: "Login failed ❌" });
    }
});

/* ===== User Profile ===== */

app.get("/api/me", requireAuth, async (req, res) => {
    res.json({ success: true, user: req.user });
});

/* ===== Orders ===== */

app.post("/api/orders", requireAuth, async (req, res) => {
    try {
        const {
            productName,
            productPrice,
            bookingType = "buy",
            rentalDays = 0,
            deliveryAddress,
            paymentMethod = "cash",
            totalPrice
        } = req.body;

        if (!productName || !deliveryAddress) {
            return res.status(400).json({ success: false, message: "Product name and address are required" });
        }

        const order = await Order.create({
            userId: req.user._id,
            productName,
            productPrice: Number(productPrice || 0),
            bookingType,
            rentalDays: Number(rentalDays || 0),
            deliveryAddress,
            paymentMethod,
            totalPrice: Number(totalPrice || productPrice || 0),
            status: "pending"
        });

        res.status(201).json({ success: true, message: "Order placed successfully ✅", order });
    } catch (error) {
        console.error("ORDER ERROR:", error);
        res.status(500).json({ success: false, message: "Order creation failed" });
    }
});

app.get("/api/orders", requireAuth, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        console.error("FETCH ORDERS ERROR:", error);
        res.status(500).json({ success: false, message: "Unable to fetch orders" });
    }
});

app.put("/api/orders/:id/status", requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        order.status = status || order.status;
        await order.save();

        res.json({ success: true, message: "Order updated", order });
    } catch (error) {
        console.error("UPDATE ORDER ERROR:", error);
        res.status(500).json({ success: false, message: "Could not update order status" });
    }
});

app.post("/api/payment/confirm", requireAuth, async (req, res) => {
    try {
        const { orderId, paymentMethod = "cash" } = req.body;
        const order = await Order.findOne({ _id: orderId, userId: req.user._id });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        order.paymentMethod = paymentMethod;
        order.status = "paid";
        await order.save();

        res.json({ success: true, message: "Payment confirmed ✅", order });
    } catch (error) {
        console.error("PAYMENT ERROR:", error);
        res.status(500).json({ success: false, message: "Payment confirmation failed" });
    }
});

/* ===== Error Handler ===== */

app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
});

/* ===== SERVER ===== */

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});