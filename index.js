require("dotenv").config();
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
app.use(bodyParser.json());

const corsOptions = {
  origin: ["https://www.alb-rev.com", "http://localhost:5173"],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Middleware to authenticate users
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

const mongoURI = process.env.MONGO_URI;
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

//   const mongoURI = "mongodb://localhost:27017/ratingService";
// mongoose
//   .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log("MongoDB connected"))
//   .catch((err) => console.log(err));

// Review Schema
const reviewSchema = new mongoose.Schema({
  rating: { type: Number, default: null },
  review: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

const Review = mongoose.model("Review", reviewSchema);

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  ratingLink: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  review: {
    type: [
      {
        rating: { type: Number, default: null },
        review: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [
      {
        rating: null,
        review: "",
        createdAt: Date.now(),
      },
    ],
  },
  admin: { type: Boolean, default: false }, // New field with default value false
  active: { type: Boolean, default: false }, // New field with default value false
});

const User = mongoose.model("User", userSchema);

// Routes

app.get("/", (req, res) => res.send("Alb-rev"));
app.get("/test-page", (req, res) =>
  res.send("This is a test page to see if everything is going OK")
);

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

// GET route to retrieve reviews by username
app.get("/api/reviews/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const user = await User.findOne({ username: username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Extract reviews from the user object
    const reviews = user.review; // Note: Corrected from user.reviews to user.review
    res.status(200).json(reviews);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error fetching reviews" });
  }
});

// POST route to register a new user
// POST route to register a new user
app.post("/api/auth/register", async (req, res) => {
  const { email, password, phone, address, username, ratingLink } = req.body;
  console.log("Received registration data:", req.body); // Debug statement
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
      ratingLink, // Ensure ratingLink is included here
      review: [
        {
          rating: null,
          review: "",
          createdAt: new Date(),
        },
      ],
      // No need to add 'admin' or 'active' here, they will default to false
    });

    await user.save();
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ token, userId: user._id, username: user.username }); // Include userId in the response
  } catch (err) {
    console.error("Error registering user:", err.message); // Debug statement
    res.status(500).json({ error: "Error registering user" });
  }
});

// POST route to submit a review for a user
app.post("/api/users/:username/review", async (req, res) => {
  const { username } = req.params;
  const { rating, review } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Push the new review object into the reviews array
    user.review.push({
      rating: rating,
      review: review,
      createdAt: new Date(),
    });

    await user.save();
    res.status(200).json({ message: "Review submitted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error submitting review" });
  }
});

// POST route to log in a user
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

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "30d" });
    res.status(200).json({ token, username: user.username, userId: user._id }); // Include username and userId in the response
  } catch (err) {
    res.status(500).json({ error: "Error logging in" });
  }
});

// GET route to retrieve user data by username
app.get("/user/:username", async (req, res) => {
  const { username } = req.params; // Get the username from the URL
  try {
    const user = await User.findOne({ username }); // Find the user by username
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ error: "Error fetching user" });
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

// // PUT route to update user information
// app.put("/api/users/:username", authenticate, async (req, res) => {
//   const { username } = req.params;
//   const { email, password, newUsername, ratingLink, active, admin } = req.body;

//   try {
//     const user = await User.findOne({ username });
//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Check if the new email is already taken by another user
//     if (email && email !== user.email) {
//       const existingUser = await User.findOne({ email });
//       if (existingUser) {
//         return res.status(400).json({ error: "Email already in use" });
//       }
//     }

//     // Check if the new username is already taken by another user
//     if (newUsername && newUsername !== user.username) {
//       const existingUser = await User.findOne({ username: newUsername });
//       if (existingUser) {
//         return res.status(400).json({ error: "Username already in use" });
//       }
//     }

//     // Update fields
//     user.email = email || user.email;
//     user.username = newUsername || user.username;
//     if (password) user.password = await bcrypt.hash(password, 10); // Hash the new password if provided
//     user.ratingLink = ratingLink || user.ratingLink;
//     if (typeof active !== "undefined") user.active = active;
//     if (typeof admin !== "undefined") user.admin = admin;

//     await user.save();
//     res.status(200).json({ message: "User updated successfully", user });
//   } catch (err) {
//     console.error("Error updating user:", err.message);
//     res.status(500).json({ error: "Error updating user" });
//   }
// });

app.put("/api/users/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const {
    email,
    password,
    username: newUsername,
    ratingLink,
    active,
    admin,
  } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update fields
    user.email = email || user.email;
    user.username = newUsername || user.username;
    if (password) user.password = await bcrypt.hash(password, 10); // Hash the new password if provided
    user.ratingLink = ratingLink || user.ratingLink;
    if (typeof active !== "undefined") user.active = active;
    if (typeof admin !== "undefined") user.admin = admin;

    await user.save();
    res.status(200).json({ message: "User updated successfully", user });
  } catch (err) {
    console.error("Error updating user:", err.message);
    res.status(500).json({ error: "Error updating user" });
  }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
