import mongoose from "mongoose";
import { randomInt } from "node:crypto";
import jwt from "jsonwebtoken";
import Company from "../models/Company.js";
import Panel from "../models/Panel.js";
import Diagram from "../models/Diagram.js";
import { findOrCreateDiagramForCompany } from "../utils/diagramUtils.js";
import { getPanelTypeCode } from "../utils/panelTypes.js";

const installerCodeAttempts = new Map();
const INSTALLER_CODE_ATTEMPT_LIMIT = 5;
const INSTALLER_CODE_WINDOW_MS = 15 * 60 * 1000;

async function generatePublicAccessCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = String(randomInt(100_000_000_000, 1_000_000_000_000));
    const exists = await Panel.exists({ publicAccessCode: code });
    if (!exists) return code;
  }
  throw new Error("Unable to allocate a unique panel access code.");
}

function buildPublicPanelUrl(req, panelId, accessCode) {
  const path = `/${encodeURIComponent(accessCode)}/${encodeURIComponent(panelId)}`;
  const baseUrl = (process.env.PUBLIC_BASE_URL || req.get("origin") || "")
    .trim()
    .replace(/\/+$/, "");
  return `${baseUrl}${path}`;
}

async function createNewQrPanel(payload, req) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const publicAccessCode = await generatePublicAccessCode();
    const publicUrl = buildPublicPanelUrl(
      req,
      payload.panelId,
      publicAccessCode,
    );
    try {
      return await Panel.create({
        ...payload,
        publicAccessCode,
        publicUrlVersion: 2,
        qrUrl: publicUrl,
        qrCodeUrl: publicUrl,
        publicPanelUrl: publicUrl,
      });
    } catch (error) {
      const isAccessCodeCollision =
        error?.code === 11000 &&
        (error?.keyPattern?.publicAccessCode ||
          error?.message?.includes("publicAccessCode"));
      if (!isAccessCodeCollision) throw error;
    }
  }
  throw new Error("Unable to allocate a unique panel access code.");
}

async function ensureLegacyPanelAccessCode(panel) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (panel.publicAccessCode) return panel;

    const accessCode = await generatePublicAccessCode();
    try {
      const claimedPanel = await Panel.findOneAndUpdate(
        {
          _id: panel._id,
          publicUrlVersion: { $ne: 2 },
          $or: [
            { publicAccessCode: { $exists: false } },
            { publicAccessCode: null },
            { publicAccessCode: "" },
          ],
        },
        { $set: { publicAccessCode: accessCode } },
        { new: true },
      )
        .select("+publicAccessCode")
        .populate("company", "name");

      if (claimedPanel) return claimedPanel;

      const latestPanel = await Panel.findById(panel._id)
        .select("+publicAccessCode")
        .populate("company", "name");
      if (!latestPanel || latestPanel.publicAccessCode) return latestPanel;
      panel = latestPanel;
    } catch (error) {
      const isAccessCodeCollision =
        error?.code === 11000 &&
        (error?.keyPattern?.publicAccessCode ||
          error?.message?.includes("publicAccessCode"));
      if (!isAccessCodeCollision) throw error;
    }
  }

  throw new Error("Unable to assign a unique panel access code.");
}

function panelPublicSummary(panel, companyName, includeInstallationDetails = false) {
  const summary = {
    panelId: panel.panelId,
    panelName: panel.panelName,
    panelType: panel.panelType,
    status: panel.status,
    companyName,
  };

  if (!includeInstallationDetails) return summary;

  return {
    ...summary,
    customer: panel.customer,
    installationLocation: panel.installationLocation,
    installer: panel.installer,
    installationDate: panel.installationDate,
    description: panel.description,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCompanyPanelPrefix(companyName) {
  const fallback = "CMP";
  if (!companyName || typeof companyName !== "string") return fallback;

  const normalized = companyName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();

  if (!normalized) return fallback;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase() || fallback;
  }

  const initials = words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return initials || fallback;
}

function normalizePanelTypeCode(panelType) {
  if (!panelType || typeof panelType !== "string") return null;

  return getPanelTypeCode(panelType);
}

async function generatePanelId(companyId, companyName, panelType) {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = getCompanyPanelPrefix(companyName);
  const panelTypeCode = normalizePanelTypeCode(panelType);
  if (!panelTypeCode) {
    throw new Error("Invalid panel type for Panel ID generation.");
  }
  const pattern = new RegExp(
    `^${escapeRegex(prefix)}${year}-${escapeRegex(panelTypeCode)}-(\\d{4})$`,
  );

  const highest = await Panel.findOne({
    companyId,
    panelId: pattern,
  }).sort({ panelId: -1 });

  const nextSequence = highest?.panelId
    ? Number(highest.panelId.match(pattern)?.[1] || "0") + 1
    : 1;

  return `${prefix}${year}-${panelTypeCode}-${String(nextSequence).padStart(4, "0")}`;
}

function validateInstrumentQuantities(technicalSpecs, instrumentModels) {
  const quantities = technicalSpecs?.instrumentQuantities;
  if (!quantities || typeof quantities !== "object") return null;
  if (!instrumentModels || typeof instrumentModels !== "object") {
    return "Instrument model data is required when quantities are provided.";
  }

  for (const [category, rawQuantity] of Object.entries(quantities)) {
    const quantity = Number(rawQuantity || 0);
    if (quantity <= 0) continue;
    const entries = instrumentModels[category];
    if (!Array.isArray(entries)) {
      return `Instrument models are missing for ${category}.`;
    }

    const total = entries.reduce((sum, entry) => {
      if (entry && typeof entry === "object") {
        const entryQuantity = Number(entry.quantity);
        return sum + (Number.isFinite(entryQuantity) && entryQuantity > 0 ? entryQuantity : 1);
      }
      return sum + 1;
    }, 0);
    if (total !== quantity) {
      return `${category} model quantities must total ${quantity}.`;
    }
  }
  return null;
}

export async function listPanels(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const { search, status, page = 1, limit = 20 } = req.query;
    const filter = { companyId };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { panelName: new RegExp(search, "i") },
        { panelId: new RegExp(search, "i") },
        { customer: new RegExp(search, "i") },
        { installationLocation: new RegExp(search, "i") },
      ];
    }

    console.log(
      `[DEBUG] listPanels - Fetching panels for company: ${companyId}`,
    );

    const panels = await Panel.find(filter)
      .populate("company", "name")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    console.log(`[DEBUG] listPanels - Found ${panels.length} panels`);
    console.log(
      `[DEBUG] listPanels - First panel company type: ${panels.length > 0 ? typeof panels[0].company : "N/A"}`,
    );

    // Add companyName to each panel for consistency
    const panelsWithNames = panels.map((p) => {
      const obj = p.toObject();
      obj.companyName = obj.company?.name || "";
      return obj;
    });

    console.log(
      `[DEBUG] listPanels - First panel companyName: ${panelsWithNames.length > 0 ? panelsWithNames[0].companyName : "N/A"}`,
    );

    const total = await Panel.countDocuments(filter);
    res.json({ panels: panelsWithNames, total });
  } catch (error) {
    console.error(`[DEBUG] listPanels - ERROR: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

export async function lookupPanel(req, res) {
  try {
    const panelId = req.params.panelId;
    console.log(`[DEBUG] lookupPanel - Fetching panel: ${panelId}`);

    const panel = await Panel.findOne({ panelId }).populate("company", "name");

    if (!panel) {
      console.log(`[DEBUG] lookupPanel - Panel not found: ${panelId}`);
      return res.status(404).json({ error: "Panel not found" });
    }

    console.log(
      `[DEBUG] lookupPanel - Panel found, company field type: ${typeof panel.company}`,
    );
    console.log(`[DEBUG] lookupPanel - Panel.company value:`, panel.company);

    const panelObj = panel.toObject();
    panelObj.companyName = panelObj.company?.name || "";

    console.log(
      `[DEBUG] lookupPanel - Final response companyName: ${panelObj.companyName}`,
    );
    console.log(`[DEBUG] lookupPanel - Final company field:`, panelObj.company);

    res.json({ panel: panelObj });
  } catch (error) {
    console.error(`[DEBUG] lookupPanel - ERROR: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

export async function generatePanelIdEndpoint(req, res) {
  try {
    if (!req.authUser?.company?._id) {
      return res
        .status(400)
        .json({ message: "User must be assigned to a company" });
    }

    const requestedCompanyId = req.query.companyId;
    const authCompanyId = req.authUser.company._id?.toString();
    let companyId = authCompanyId;

    if (requestedCompanyId) {
      if (typeof requestedCompanyId !== "string") {
        return res.status(400).json({ message: "companyId must be a string" });
      }
      if (
        requestedCompanyId !== authCompanyId &&
        req.authUser.role !== "super_admin"
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized for requested company" });
      }
      companyId = requestedCompanyId;
    }

    const company = await Company.findById(companyId).lean();
    if (!company) {
      return res.status(400).json({ message: "Invalid companyId" });
    }

    const panelType = req.query.panelType || req.body?.panelType;
    if (!panelType || typeof panelType !== "string") {
      return res.status(400).json({ message: "panelType is required" });
    }
    const panelTypeCode = normalizePanelTypeCode(panelType);
    if (!panelTypeCode) {
      return res.status(400).json({ message: "Invalid panel type" });
    }

    const panelId = await generatePanelId(
      companyId,
      company?.name,
      panelTypeCode,
    );
    res.json({ panelId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function generateQr(req, res) {
  try {
    const panelId = req.params.id;
    const panel = await Panel.findById(panelId).select("+publicAccessCode");
    if (!panel) return res.status(404).json({ error: "Panel not found" });

    const usesUniqueUrl =
      panel.publicUrlVersion === 2 && panel.publicAccessCode;
    const publicPath = usesUniqueUrl
      ? `/${encodeURIComponent(panel.publicAccessCode)}/${encodeURIComponent(panel.panelId)}`
      : `/panel/${panel.panelId}`;
    const publicUrl = usesUniqueUrl
      ? buildPublicPanelUrl(req, panel.panelId, panel.publicAccessCode)
      : (process.env.PUBLIC_BASE_URL || "") + publicPath;

    // For now store the publicPanelUrl and generated timestamp
    panel.publicPanelUrl = publicUrl;
    panel.qrCodeUrl = publicUrl; // store same as QR payload URL for reference
    panel.qrUrl = publicUrl;
    panel.qrGeneratedAt = new Date();
    await panel.save();

    // Return the public URL and relative path for frontend to render
    res.json({ publicPanelUrl: publicUrl, publicPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function publicPanel(req, res) {
  try {
    const panelId = req.params.panelId;
    let panel = await Panel.findOne({ panelId })
      .select("+publicAccessCode")
      .populate("company", "name");
    if (!panel) return res.status(404).json({ error: "Panel not found" });

    if (panel.publicUrlVersion === 2) {
      return res.json({
        panel: panelPublicSummary(panel, panel.company?.name || ""),
        requiresUniqueUrl: true,
      });
    }

    if (panel.status === "Installed" && !panel.publicAccessCode) {
      panel = await ensureLegacyPanelAccessCode(panel);
      if (!panel) return res.status(404).json({ error: "Panel not found" });
    }

    res.json({
      panel: panelPublicSummary(panel, panel.company?.name || ""),
      ...(panel.status === "Installed"
        ? { publicAccessCode: panel.publicAccessCode }
        : {}),
    });
  } catch (error) {
    console.error("Public panel lookup failed:", error.message);
    res.status(500).json({ error: error.message });
  }
}

export async function publicPanelDetails(req, res) {
  try {
    const { panelId, accessCode } = req.params;
    const panel = await Panel.findOne({
      panelId,
      publicAccessCode: accessCode,
    })
      .select("+publicAccessCode")
      .populate("company", "name");

    if (!panel) return res.status(404).json({ error: "Panel not found" });

    if (panel.status !== "Installed") {
      return res.json({
        panel: panelPublicSummary(panel, panel.company?.name || ""),
      });
    }

    const safe = panel.toObject();
    safe.companyName = safe.company?.name || "";
    delete safe.companyId;
    delete safe.company;
    delete safe.createdBy;
    delete safe.updatedBy;
    delete safe.publicAccessCode;

    return res.json({ panel: safe });
  } catch (error) {
    console.error("Public panel detail lookup failed:", error.message);
    return res.status(500).json({ error: "Unable to load panel details." });
  }
}

export async function verifyInstallerCode(req, res) {
  const panelId = req.params.panelId;
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const attemptKey = `${panelId}:${clientIp}`;
  const now = Date.now();
  const attempt = installerCodeAttempts.get(attemptKey);

  if (attempt && attempt.expiresAt <= now) {
    installerCodeAttempts.delete(attemptKey);
  } else if (attempt && attempt.count >= INSTALLER_CODE_ATTEMPT_LIMIT) {
    res.set(
      "Retry-After",
      String(Math.ceil((attempt.expiresAt - now) / 1000)),
    );
    return res.status(429).json({
      error: "Too many code attempts. Please try again later.",
    });
  }

  try {
    const panel = await Panel.findOne({ panelId })
      .select("+publicAccessCode")
      .populate("company", "name");
    if (!panel) return res.status(404).json({ error: "Panel not found" });
    if (
      panel.publicUrlVersion === 2 &&
      (req.body.publicAccessCode !== panel.publicAccessCode ||
        !panel.publicAccessCode)
    ) {
      return res.status(404).json({ error: "Panel not found" });
    }
    if (panel.status === "Installed") {
      return res.status(409).json({ error: "Installation already completed." });
    }

    const company = await Company.findById(panel.companyId).lean();
    const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
    if (!company?.installerAccessCode || code !== company.installerAccessCode) {
      const current = installerCodeAttempts.get(attemptKey);
      installerCodeAttempts.set(attemptKey, {
        count:
          current && current.expiresAt > now ? current.count + 1 : 1,
        expiresAt:
          current && current.expiresAt > now
            ? current.expiresAt
            : now + INSTALLER_CODE_WINDOW_MS,
      });
      return res.status(403).json({ error: "Invalid installer code." });
    }

    installerCodeAttempts.delete(attemptKey);
    const tokenPayload = { purpose: "panel-installation", panelId };
    if (panel.publicUrlVersion === 2) {
      tokenPayload.publicAccessCode = panel.publicAccessCode;
    }
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "10m" },
    );

    return res.json({
      token,
      panel: panelPublicSummary(panel, panel.company?.name || "", true),
    });
  } catch (error) {
    console.error("Installer code verification failed:", error.message);
    return res.status(500).json({ error: "Unable to verify installer code." });
  }
}

export async function completeInstallation(req, res) {
  try {
    const authorization = req.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    let tokenPayload;
    try {
      tokenPayload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    } catch {
      return res.status(401).json({ error: "Installer verification required." });
    }

    if (
      tokenPayload.purpose !== "panel-installation" ||
      tokenPayload.panelId !== req.params.panelId
    ) {
      return res.status(403).json({ error: "Invalid installer authorization." });
    }

    const panel = await Panel.findOne({ panelId: req.params.panelId }).select(
      "+publicAccessCode",
    );
    if (!panel) return res.status(404).json({ error: "Panel not found" });

    if (
      tokenPayload.publicAccessCode &&
      (panel.publicUrlVersion !== 2 ||
        panel.publicAccessCode !== tokenPayload.publicAccessCode)
    ) {
      return res.status(403).json({ error: "Invalid installer authorization." });
    }

    if (
      panel.status === "Installed" ||
      (panel.installer && panel.installationDate && panel.installationLocation)
    ) {
      return res.status(400).json({ error: "Installation already completed." });
    }

    const updates = {};
    if (req.body.installer !== undefined)
      updates.installer = req.body.installer;
    if (req.body.installationDate !== undefined)
      updates.installationDate = req.body.installationDate;
    if (req.body.installationLocation !== undefined)
      updates.installationLocation = req.body.installationLocation;

    if (
      updates.installer?.trim() &&
      updates.installationDate?.trim() &&
      updates.installationLocation?.trim()
    ) {
      updates.status = "Installed";
      updates.qrGenerated = true;
      if (panel.publicUrlVersion !== 2 && !panel.publicAccessCode) {
        updates.publicAccessCode = await generatePublicAccessCode();
      }
    }

    const updatedPanel = await Panel.findOneAndUpdate(
      { panelId: req.params.panelId },
      { $set: updates },
      { new: true },
    ).populate("company", "name");

    const panelObj = updatedPanel.toObject();
    panelObj.companyName = panelObj.company?.name || "";

    console.log(
      `[DEBUG] completeInstallation - Updated panel with company: ${panelObj.companyName}`,
    );
    res.json({
      panel: panelObj,
      ...(updates.publicAccessCode || panel.publicAccessCode
        ? { publicAccessCode: updates.publicAccessCode || panel.publicAccessCode }
        : {}),
    });
  } catch (error) {
    console.error(`[DEBUG] completeInstallation - ERROR: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

export async function createPanel(req, res) {
  try {
    if (!req.authUser?.company?._id) {
      return res
        .status(400)
        .json({ error: "User must be assigned to a company" });
    }

    const companyId = req.authUser.company._id;
    const company = await Company.findById(companyId).lean();
    // Allow client to supply a previously-generated panelId (from generate-id endpoint)
    const requestedPanelId = req.body?.panelId;
    let panelId;
    if (requestedPanelId) {
      panelId = requestedPanelId;
    } else {
      const panelTypeCode = normalizePanelTypeCode(req.body.panelType);
      if (!panelTypeCode) {
        return res.status(400).json({ error: "Invalid or missing panelType" });
      }
      panelId = await generatePanelId(companyId, company?.name, panelTypeCode);
    }
    const existingPanel = await Panel.findOne({ panelId, companyId });
    if (existingPanel) {
      return res
        .status(409)
        .json({ error: "Panel ID already exists. Retry creation." });
    }

    // whitelist allowed fields to avoid accepting documents/maintenance
    const allowed = [
      "panelName",
      "panelType",
      "manufacturingDate",
      "installationDate",
      "customer",
      "installer",
      "manufacturer",
      "installationLocation",
      "projectName",
      "description",
      "status",
      "motorConfiguration",
      "technicalSpecs",
      "images",
      "diagrams",
      "instrumentModels",
      "wiring",
      "connections",
    ];

    const payload = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) payload[k] = req.body[k];
    });

    const instrumentError = validateInstrumentQuantities(
      payload.technicalSpecs,
      payload.instrumentModels,
    );
    if (instrumentError) return res.status(400).json({ error: instrumentError });

    // Installation status can only be established by the completion endpoint.
    payload.status = "Ready";

    payload.panelId = panelId;
    payload.company = companyId;
    payload.companyId = companyId;
    payload.createdBy = req.authUser._id;
    payload.updatedBy = req.authUser._id;

    if (Array.isArray(payload.diagrams)) {
      const nextDiagrams = [];
      for (const entry of payload.diagrams) {
        const trimmed = entry && typeof entry === "object" ? entry : {};
        if (!trimmed.url && !trimmed.publicId) {
          nextDiagrams.push(trimmed);
          continue;
        }

        const diagram = await findOrCreateDiagramForCompany(
          {
            companyId: String(companyId),
            name: trimmed.name || "Wiring Diagram",
            url: trimmed.url || "",
            publicId: trimmed.publicId || "",
            fileType: trimmed.fileType || "",
            libraryId: trimmed.libraryId || "",
          },
          {
            findOne: (query) => Diagram.findOne({ companyId, ...query }),
            create: (data) =>
              Diagram.create({ ...data, company: companyId, companyId }),
          },
        );

        if (diagram) {
          nextDiagrams.push({
            ...trimmed,
            url: diagram.url || trimmed.url || "",
            publicId: diagram.publicId || trimmed.publicId || "",
            fileType: diagram.fileType || trimmed.fileType || "",
            source:
              trimmed.libraryId ||
              diagram.libraryId ||
              diagram._id?.toString?.()
                ? "library"
                : trimmed.source || "upload",
            libraryId:
              diagram.libraryId ||
              trimmed.libraryId ||
              diagram._id?.toString?.() ||
              "",
          });
        } else {
          nextDiagrams.push(trimmed);
        }
      }
      payload.diagrams = nextDiagrams;
    }

    const panel = await createNewQrPanel(payload, req);

    // Populate company name before returning
    const populatedPanel = await Panel.findById(panel._id).populate(
      "company",
      "name",
    );
    const panelObj = populatedPanel.toObject();
    panelObj.companyName = panelObj.company?.name || "";

    console.log(
      `[DEBUG] createPanel - Created panel with company: ${panelObj.companyName}`,
    );
    res.json({ panel: panelObj });
  } catch (error) {
    console.error(`[DEBUG] createPanel - ERROR: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

export async function updatePanel(req, res) {
  try {
    const panel = await Panel.findById(req.params.id);
    if (!panel) return res.status(404).json({ error: "Panel not found" });

    if (!req.authUser || !req.authUser.role)
      return res.status(403).json({ error: "Unauthorized" });
    const isCompanyAdmin =
      req.authUser.role === "company_admin" &&
      String(req.authUser.company._id) === String(panel.companyId);
    if (!isCompanyAdmin)
      return res
        .status(403)
        .json({ error: "Only company admins can update panels." });

    // Only allow updates to specific fields
    const allowed = [
      "panelName",
      "panelType",
      "manufacturingDate",
      "installationDate",
      "customer",
      "installer",
      "manufacturer",
      "installationLocation",
      "projectName",
      "description",
      "status",
      "motorConfiguration",
      "technicalSpecs",
      "images",
      "diagrams",
      "instrumentModels",
      "wiring",
      "connections",
    ];

    const updates = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    const instrumentError = validateInstrumentQuantities(
      updates.technicalSpecs || panel.technicalSpecs,
      updates.instrumentModels || panel.instrumentModels,
    );
    if (instrumentError) return res.status(400).json({ error: instrumentError });

    if (updates.status !== undefined) {
      if (!["Ready", "Installed"].includes(updates.status)) {
        return res.status(400).json({ error: "Invalid panel status." });
      }
      if (updates.status !== panel.status) {
        return res.status(400).json({
          error: "Panel status changes must use the installation flow.",
        });
      }
    }

    updates.updatedBy = req.authUser._id;

    const updated = await Panel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true },
    ).populate("company", "name");

    const panelObj = updated.toObject();
    panelObj.companyName = panelObj.company?.name || "";

    console.log(
      `[DEBUG] updatePanel - Updated panel with company: ${panelObj.companyName}`,
    );
    res.json({ panel: panelObj });
  } catch (error) {
    console.error(`[DEBUG] updatePanel - ERROR: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

export async function deletePanel(req, res) {
  try {
    const companyId = req.authUser.company._id;
    const idQuery = mongoose.Types.ObjectId.isValid(req.params.id)
      ? [{ _id: req.params.id }, { panelId: req.params.id }]
      : [{ panelId: req.params.id }];

    const query = {
      $or: idQuery,
    };

    if (req.authUser.role !== "super_admin") {
      query.companyId = companyId;
    }

    const panel = await Panel.findOneAndDelete(query);
    if (!panel) return res.status(404).json({ error: "Panel not found" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export { generatePanelIdEndpoint as generatePanelId };
