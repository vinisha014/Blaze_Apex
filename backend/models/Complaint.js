const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema({
  text: { type: String, required: true },
  normalizedText: { type: String },

  department: { type: String },

  // Duplicate handling
  duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", default: null },
  duplicateCount: { type: Number, default: 1 },
  reporterUserIds: [{ type: String }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Complaint", complaintSchema);
