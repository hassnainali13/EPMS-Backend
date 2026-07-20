import jwt from "jsonwebtoken";
import Company from "../models/Company.js";
import User from "../models/User.js";

function createToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "15m" },
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    { id: user._id.toString() },
    process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    { expiresIn: "7d" },
  );
}

export async function signup(req, res) {
  try {
    const rawName = req.body.name;
    const rawEmail = req.body.email;
    const rawCompanyName = req.body.companyName;
    const rawCompanyLogoUrl = req.body.companyLogoUrl;
    const password = req.body.password;

    const name = typeof rawName === "string" ? rawName.trim() : "";
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    const companyName =
      typeof rawCompanyName === "string" ? rawCompanyName.trim() : "";
    const companyLogoUrl =
      typeof rawCompanyLogoUrl === "string" ? rawCompanyLogoUrl.trim() : "";

    if (!name || !email || !password || !companyName) {
      return res
        .status(400)
        .json({ error: "Name, email, password and company name are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "User already exists" });

    const slugBase = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const company = await Company.create({
      name: companyName,
      email,
      logoUrl: companyLogoUrl || undefined,
      slug: `${slugBase || "company"}-${Date.now()}`,
    });

    const user = await User.create({
      name,
      email,
      password,
      role: "company_admin",
      company: company._id,
      companyId: company._id,
    });

    const token = createToken(user);
    const refreshToken = createRefreshToken(user);
    return res.status(201).json({
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        company: company._id,
        companyName: company.name,
        companyLogoUrl: company.logoUrl,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      const keys = Object.keys(error.keyPattern || error.keyValue || {});
      const field = keys.length ? keys[0] : "email";
      return res.status(409).json({ error: `${field} already exists` });
    }
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
}

export async function login(req, res) {
  try {
    const rawEmail = req.body.email;
    const { password } = req.body;
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email }).populate("company");
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (user.blocked)
      return res.status(403).json({ error: "Account is suspended" });

    const matched = await user.comparePassword(password);
    if (!matched) return res.status(401).json({ error: "Invalid credentials" });

    const token = createToken(user);
    const refreshToken = createRefreshToken(user);
    return res.json({
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        company: user.company?._id || null,
        companyName: user.company?.name || "",
        companyLogoUrl: user.company?.logoUrl || "",
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }
    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    );
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: "Invalid refresh token" });
    const token = createToken(user);
    return res.json({ token });
  } catch (error) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
}

export async function getCurrentUser(req, res) {
  const safeUser = {
    id: req.authUser._id,
    name: req.authUser.name,
    email: req.authUser.email,
    role: req.authUser.role,
    plan: req.authUser.plan,
    blocked: req.authUser.blocked,
    company: req.authUser.company?._id || req.authUser.company,
    companyName: req.authUser.company?.name || "",
    companyLogoUrl: req.authUser.company?.logoUrl || "",
    createdAt: req.authUser.createdAt,
  };
  res.json({ user: safeUser });
}

export function logout(_req, res) {
  res.json({ ok: true });
}
