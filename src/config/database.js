import mongoose from "mongoose";

export async function connectDatabase(mongoUri) {
  if (!mongoUri) {
    throw new Error("MONGO_URI is not configured");
  }

  await mongoose.connect(mongoUri);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
