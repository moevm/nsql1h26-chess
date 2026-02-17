const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// подключение к MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/textdb");

// схема и модель
const TextSchema = new mongoose.Schema({
    text: String,
});

const TextModel = mongoose.model("Text", TextSchema);

// получить все записи
app.get("/api/texts", async (req, res) => {
    const texts = await TextModel.find();
    res.json(texts);
});

// добавить текст
app.post("/api/texts", async (req, res) => {
    const { text } = req.body;
    const newText = new TextModel({ text });
    await newText.save();
    res.json(newText);
});

app.listen(3000, () => {
    console.log("Server started on http://localhost:3000");
});