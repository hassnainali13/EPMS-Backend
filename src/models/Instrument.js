import mongoose from "mongoose";

const instrumentSchema = new mongoose.Schema(
  {
    // Simplified instrument model: category, company, name, status, companyId, fingerprint
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    status: { type: String, trim: true, default: "Active" },
    fingerprint: { type: String, trim: true, default: null },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

// Compound index could be added, but avoid enforcing uniqueness at DB level
// to prevent migration issues; duplicate checks are performed in controller.
instrumentSchema.index({ category: 1, company: 1, name: 1 });

export default mongoose.model("Instrument", instrumentSchema);
