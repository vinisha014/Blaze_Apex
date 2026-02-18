function normalize(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccardSimilarity(text1, text2) {
  const set1 = new Set(normalize(text1).split(" "));
  const set2 = new Set(normalize(text2).split(" "));

  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

async function findDuplicate({ Complaint, text, department, threshold = 0.6 }) {
  const complaints = await Complaint.find({
    department,
    duplicateOf: null // only check main complaints
  });

  let bestMatch = null;
  let highestScore = 0;

  for (const complaint of complaints) {
    const score = jaccardSimilarity(text, complaint.text);

    if (score > highestScore) {
      highestScore = score;
      bestMatch = complaint;
    }
  }

  if (highestScore >= threshold) {
    return { complaint: bestMatch, score: highestScore };
  }

  return null;
}

module.exports = { normalize, findDuplicate };
