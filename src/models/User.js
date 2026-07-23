import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: [
        "super_admin",
        "company_admin",
        "employee",
        "guest",
        "engineer",
        "supervisor",
        "viewer",
      ],
      default: "employee",
    },
    plan: { type: String, enum: ["FREE", "PREMIUM"], default: "FREE" },
    blocked: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    verificationOTPHash: { type: String, default: null },
    verificationOTPExpiresAt: { type: Date, default: null },
    verificationOTPRequestedAt: { type: Date, default: null },
    forgotPasswordOTPHash: { type: String, default: null },
    forgotPasswordOTPExpiresAt: { type: Date, default: null },
    forgotPasswordOTPRequestedAt: { type: Date, default: null },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    assignedPanels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Panel",
      },
    ],
    phone: { type: String, default: "" },
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
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model("User", userSchema);
