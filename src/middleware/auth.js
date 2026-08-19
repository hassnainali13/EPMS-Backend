import jwt from "jsonwebtoken";
import User from "../models/User.js";

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function requireUser(req, res, next) {
  try {
    const user = await User.findById(req.user?.id).populate("company");
    if (!user) return res.status(401).json({ error: "User not found" });
    if (!user.company)
      return res
        .status(400)
        .json({ error: "User must be assigned to a company" });
    if (user.blocked)
      return res.status(403).json({ error: "Account is suspended" });
    req.authUser = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
}

export function authorize(...allowed) {
  return (req, res, next) => {
    if (!req.authUser)
      return res.status(401).json({ error: "Authentication required" });
    if (!allowed.includes(req.authUser.role)) {
      return res.status(403).json({ error: "Permission denied" });
    }
    next();
  };
}
