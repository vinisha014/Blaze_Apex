const natural = require("natural");
const classifier = new natural.BayesClassifier();

// ✅ Add training examples (add more for better accuracy)
const TRAIN = [
  // Electricity
  ["streetlight not working", "Electricity"],
  ["power line broken", "Electricity"],
  ["electric pole damaged", "Electricity"],
  ["no current in area", "Electricity"],

  // Roads
  ["pothole in road", "Roads"],
  ["road damaged", "Roads"],
  ["crack on road", "Roads"],
  ["asphalt broken", "Roads"],

  // Sanitation
  ["garbage not collected", "Sanitation"],
  ["trash overflow", "Sanitation"],
  ["waste dumped", "Sanitation"],
  ["bad smell from garbage", "Sanitation"],

  // Water / Drainage
  ["water leakage", "Water"],
  ["pipe burst", "Water"],
  ["drain overflow", "Water"],
  ["water stagnation", "Water"],

  // Fire
  ["fire accident", "Fire"],
  ["smoke in building", "Fire"],
];

for (const [text, label] of TRAIN) classifier.addDocument(text, label);
classifier.train();

function classifyText(text) {
  const t = (text || "").toLowerCase().trim();

  const ranked = classifier.getClassifications(t);
  const department = ranked[0].label;
  const confidence = ranked[0].value;

  if (confidence < 0.4) {
    return {
      department: "Unknown",
      confidence,
      ranked
    };
  }

  return {
    department,
    confidence,
    ranked
  };
}

module.exports = { classifyText };
