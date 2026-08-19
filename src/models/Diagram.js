import mongoose from "mongoose";

const diagramSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    fileType: { type: String, default: "" },
    source: { type: String, enum: ["upload", "library"], default: "upload" },
    libraryId: { type: String, default: "" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

diagramSchema.index({ companyId: 1, name: 1 });

export default mongoose.model("Diagram", diagramSchema);
