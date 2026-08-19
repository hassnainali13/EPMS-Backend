import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      default: null,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    ownerName: { type: String, default: "" },
    phone: { type: String, default: "" },
    description: { type: String, default: "" },
    expiryDate: { type: String, default: "" },
    subscriptionStatus: {
      type: String,
      enum: ["Active", "Expired", "Trial"],
      default: "Active",
    },
    industry: { type: String, default: "Electrical" },
    address: { type: String, default: "" },
    website: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    installerAccessCode: { type: String, default: "" },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
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

export default mongoose.model("Company", companySchema);
