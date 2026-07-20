import mongoose from "mongoose";

const maintenanceSchema = new mongoose.Schema(
  {
    panel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Panel",
      required: true,
    },
    engineer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    faultDetails: { type: String, default: "" },
    resolution: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Open", "In Progress", "Resolved", "Closed"],
      default: "Open",
    },
    nextMaintenanceDate: { type: String, default: "" },
    notes: { type: String, default: "" },
    images: [{ type: String }], 
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

maintenanceSchema.index({ companyId: 1, status: 1, createdAt: -1 });

export default mongoose.model("Maintenance", maintenanceSchema);
