require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");

const { analyzeImage } = require("./services/rekognitionService");
const { speechToText } = require("./services/transcribeService");
const { classifyText } = require("./services/nbClassifier");


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Debug logger
app.use((req, res, next) => {
  console.log("HIT:", req.method, req.url);
  next();
});

// Multer upload
const upload = multer({ dest: "uploads/" });

// Health
app.get("/", (req, res) => {
  res.send("AI Service Running ✅ (Rekognition + Transcribe + NLP)");
});

// ✅ IMAGE RECOGNITION
app.post("/analyze-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded (key must be 'image')" });

    const result = await analyzeImage(req.file.path);

    return res.json({
      success: true,
      department: result.department,
      usefulLabels: result.usefulLabels,
      labels: result.rawLabels,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
});

// ✅ SPEECH TO TEXT + NLP
app.post("/speech-to-text", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio uploaded (key must be 'audio')" });

    const transcript = await speechToText({
      filePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    const nlp = classifyText(transcript); // { department, ranked }

    return res.json({
      success: true,
      transcript,
      department: nlp.department,
      ranked: nlp.ranked, // optional (remove if you don’t want it)
    });
  } catch (error) {
    console.error("TRANSCRIBE ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ✅ TEXT ONLY NLP
app.post("/classify-text", upload.none(), (req, res) => {
  try {
    const text = req.body?.text;
    if (!text) return res.status(400).json({ error: "text is required" });

    const result = classifyText(text); // { department, ranked }
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("NLP ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
