const { RekognitionClient, DetectLabelsCommand } = require("@aws-sdk/client-rekognition");
const fs = require("fs");

const client = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Extra noise labels to ignore (generic / irrelevant)
const STOP_LABELS = new Set([
  "Animal", "Bird", "Fish", "Sea Life", "Shark",
  "Sky", "Cloud", "Outdoors", "Nature", "Plant", "Tree",
]);

// Remove entire categories we don’t want for civic classification
const BLOCKED_CATEGORIES = new Set([
  "Animals and Pets",
]);

function scoreDepartment(names) {
  let roads = 0, water = 0, electric = 0, sanitation = 0, fire = 0;

  for (const n of names) {
    // Roads
    if (["Road", "Tarmac", "Asphalt", "Concrete", "Construction", "Tarmac"].includes(n)) roads += 2;
    if (["Hole", "Pothole", "Crack", "Damage"].includes(n)) roads += 4;

    // Water / Drainage
    if (["Water", "Flood", "Leak", "Pipe", "Drain", "Sewage", "Puddle"].includes(n)) water += 2;

    // Electricity / Streetlight
    if (["Street Light", "Lamp", "Light", "Utility Pole", "Power Line", "Electricity", "Wire", "Cable"].includes(n)) electric += 3;

    // Sanitation
    if (["Garbage", "Trash", "Waste", "Dump", "Litter", "Rubbish"].includes(n)) sanitation += 3;

    // Fire
    if (["Fire", "Smoke", "Flame", "Explosion"].includes(n)) fire += 5;
  }

  const scores = [
    { dept: "Roads / Public Works", score: roads },
    { dept: "Water / Drainage", score: water },
    { dept: "Electricity / Streetlight", score: electric },
    { dept: "Sanitation", score: sanitation },
    { dept: "Fire & Emergency", score: fire },
  ].sort((a, b) => b.score - a.score);

  return scores[0].score > 0 ? scores[0].dept : "Unknown";
}

const analyzeImage = async (imagePath) => {
  const imageBytes = fs.readFileSync(imagePath);

  const command = new DetectLabelsCommand({
    Image: { Bytes: imageBytes },
    MaxLabels: 25,
    MinConfidence: 60,
  });

  const response = await client.send(command);

  const raw = response.Labels || [];

  // 1) Drop labels that belong to blocked categories (ex: Animals and Pets)
  const categoryFiltered = raw.filter((l) => {
    const cats = l.Categories || [];
    return !cats.some((c) => BLOCKED_CATEGORIES.has(c.Name));
  });

  // 2) Get names + remove generic STOP labels
  const allNames = categoryFiltered.map((x) => x.Name);
  const usefulNames = allNames.filter((n) => !STOP_LABELS.has(n));

  // 3) Score-based department classification
  const department = scoreDepartment(usefulNames);

  return {
    department,
    usefulLabels: usefulNames,
    rawLabels: raw,
  };
};

module.exports = { analyzeImage };
