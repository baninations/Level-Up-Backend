const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

// Initialize the app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

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
});

const Review = mongoose.model("Review", reviewSchema);

// Routes
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

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
