const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Middleware to authenticate user
const authenticate = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token.split(" ")[1], JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Failed to authenticate token" });
    }
    req.userId = decoded.id; // Add userId to request object for further use
    next(); // Pass the request to the next middleware
  });
};

// MongoDB connection
const mongoURI = "mongodb://localhost:27017";
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Review Schema
const reviewSchema = new mongoose.Schema({
  rating: { type: Number, required: true },
  review: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Review = mongoose.model("Review", reviewSchema);

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

// Routes

// POST route to create a new review
app.post("/api/reviews", async (req, res) => {
  const { rating, review } = req.body;
  try {
    const newReview = new Review({ rating, review });
    await newReview.save();
    res.status(201).json(newReview);
  } catch (err) {
    res.status(500).json({ error: "Error saving review" });
  }
});

// GET route to retrieve all reviews
app.get("/api/reviews", authenticate, async (req, res) => {
  try {
    const reviews = await Review.find();
    res.status(200).json(reviews);
  } catch (err) {
    res.status(500).json({ error: "Error fetching reviews" });
  }
});

// POST route to register a new user
app.post("/api/auth/register", async (req, res) => {
  const { email, password, phone, address, username } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: "User already exists" });
    }

    user = new User({
      email,
      password: await bcrypt.hash(password, 10),
      phone,
      address,
      username,
    });

    await user.save();
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ token });
  } catch (err) {
    res.status(500).json({ error: "Error registering user" });
  }
});

// POST route to login a user
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });
    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: "Error logging in" });
  }
});

// GET route to retrieve all users (protected)
app.get("/api/users", authenticate, async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: "Error fetching users" });
  }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
