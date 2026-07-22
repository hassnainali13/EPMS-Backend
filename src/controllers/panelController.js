import mongoose from "mongoose";
import Company from "../models/Company.js";
import Panel from "../models/Panel.js";
import Diagram from "../models/Diagram.js";
import { findOrCreateDiagramForCompany } from "../utils/diagramUtils.js";
import { getPanelTypeCode } from "../utils/panelTypes.js";

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
    const panel = await Panel.findById(panelId);
    if (!panel) return res.status(404).json({ error: "Panel not found" });

    // Build public URL (relative by default)
    const publicPath = `/panel/${panel.panelId}`;
    const publicUrl = (process.env.PUBLIC_BASE_URL || "") + publicPath;

    // For now store the publicPanelUrl and generated timestamp
    panel.publicPanelUrl = publicUrl;
    panel.qrCodeUrl = publicUrl; // store same as QR payload URL for reference
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
    console.log(`[DEBUG] publicPanel - Fetching panel: ${panelId}`);

    const panel = await Panel.findOne({ panelId }).populate("company", "name");

    if (!panel) {
      console.log(`[DEBUG] publicPanel - Panel not found: ${panelId}`);
      return res.status(404).json({ error: "Panel not found" });
    }

    console.log(
      `[DEBUG] publicPanel - Panel found, company field type: ${typeof panel.company}`,
    );
    console.log(`[DEBUG] publicPanel - Panel.company value:`, panel.company);

    // Return same shape as lookupPanel but without sensitive fields
    const safe = panel.toObject();
    safe.companyName = safe.company?.name || "";

    console.log(
      `[DEBUG] publicPanel - Before deletion - company:`,
      safe.company,
    );
    console.log(
      `[DEBUG] publicPanel - Before deletion - companyName: ${safe.companyName}`,
    );

    delete safe.companyId;
    delete safe.company;
    delete safe.createdBy;
    delete safe.updatedBy;

    console.log(
      `[DEBUG] publicPanel - After deletion - company:`,
      safe.company,
    );
    console.log(
      `[DEBUG] publicPanel - Final response companyName: ${safe.companyName}`,
    );

    res.json({ panel: safe });
  } catch (error) {
    console.error(`[DEBUG] publicPanel - ERROR: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

export async function completeInstallation(req, res) {
  try {
    const installerCode = req.body.code;
    const panel = await Panel.findOne({ panelId: req.params.panelId });
    if (!panel) return res.status(404).json({ error: "Panel not found" });

    const company = await Company.findById(panel.companyId).lean();
    if (!company) return res.status(404).json({ error: "Company not found" });

    if (
      !installerCode ||
      installerCode !== company.installerAccessCode ||
      !company.installerAccessCode
    ) {
      return res.status(403).json({ error: "Invalid installer code." });
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

    if (updates.installer || updates.installationDate) {
      updates.status = "Installed";
      updates.qrGenerated = true;
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
    res.json({ panel: panelObj });
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

    const panel = await Panel.create(payload);

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
