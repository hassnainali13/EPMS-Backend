import Instrument from "../models/Instrument.js";
import Panel from "../models/Panel.js";
import {
  normalizeInstrumentFingerprint,
  normalizeInstrumentPayload,
  parseImportRows,
} from "../utils/instrumentUtils.js";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildImportResponse({
  created,
  duplicateRecords,
  invalidRecords,
  rows,
}) {
  const duplicates = duplicateRecords.filter(
    (record) => record.reason === "Already Exists",
  ).length;

  return {
    success: true,
    processed: rows.length,
    inserted: created.length,
    duplicates,
    invalid: invalidRecords.length,
    duplicateRecords,
    invalidRecords,
    created,
  };
}

function buildProgressPayload({
  processed,
  total,
  inserted,
  duplicates,
  invalid,
  current,
}) {
  return {
    processed,
    total,
    inserted,
    duplicates,
    invalid,
    current,
  };
}

async function processImportRows(rows, { req, onProgress, batchSize = 50 }) {
  const created = [];
  const duplicateRecords = [];
  const invalidRecords = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const normalized = normalizeInstrumentPayload(row);

    const name = normalized.name;
    const category = normalized.category;
    const company = normalized.company;
    const reasons = [];

    if (!category) reasons.push("Category is required");
    if (!company) reasons.push("Company is required");
    if (!name) reasons.push("Name is required");

    if (reasons.length > 0) {
      invalidRecords.push({
        row: { category, company, name },
        reason: reasons.join("; "),
      });
      continue;
    }

    const existing = await Instrument.findOne({
      name: new RegExp("^" + escapeRegex(name) + "$", "i"),
      category: new RegExp("^" + escapeRegex(category) + "$", "i"),
      company: new RegExp("^" + escapeRegex(company) + "$", "i"),
    });

    if (existing) {
      duplicateRecords.push({
        row: { category, company, name },
        reason: "Already Exists",
      });
      continue;
    }

    const fingerprint =
      typeof globalThis?.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : Math.random().toString(36).slice(2, 12);

    const instrument = await Instrument.create({
      name,
      category: normalized.category,
      company: normalized.company,
      status: normalized.status || "Active",
      fingerprint,
      companyId: req.authUser?.companyId || req.authUser?._id || null,
    });
    created.push(instrument);

    if ((index + 1) % batchSize === 0 || index === rows.length - 1) {
      const duplicates = duplicateRecords.filter(
        (record) => record.reason === "Already Exists",
      ).length;

      await onProgress(
        buildProgressPayload({
          processed: index + 1,
          total: rows.length,
          inserted: created.length,
          duplicates,
          invalid: invalidRecords.length,
          current: {
            category: normalized.category,
            company: normalized.company,
            name: normalized.name,
          },
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  return {
    created,
    duplicateRecords,
    invalidRecords,
    rows,
  };
}

async function streamImportProgress(res, payload, eventName = "progress") {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function listInstruments(req, res) {
  try {
    // Return all instruments. Filtering/searching will be performed client-side
    // to support dynamic dropdowns and fast client-side interactions.
    const instruments = await Instrument.find({}).sort({ createdAt: -1 });
    const total = instruments.length;

    res.json({ instruments, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function listPanelOptions(req, res) {
  try {
    const instruments = await Instrument.find({
      $or: [{ status: { $exists: false } }, { status: { $ne: "Inactive" } }],
    }).sort({ createdAt: -1 });

    res.json({ instruments, total: instruments.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createInstrument(req, res) {
  try {
    console.log("createInstrument called", {
      user: req.authUser
        ? { id: req.authUser._id, role: req.authUser.role }
        : null,
      body: req.body,
    });
    const payload = normalizeInstrumentPayload(req.body);
    const name = payload.name;
    const company = payload.company;
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!payload.category)
      return res.status(400).json({ error: "Category is required" });
    if (!company) return res.status(400).json({ error: "Company is required" });

    // duplicate check by category + company + name (case-insensitive)
    const existing = await Instrument.findOne({
      name: new RegExp(`^${escapeRegex(name)}$`, "i"),
      category: new RegExp(`^${escapeRegex(payload.category)}$`, "i"),
      company: new RegExp(`^${escapeRegex(company)}$`, "i"),
    });
    if (existing)
      return res.status(409).json({ error: "Instrument already exists" });

    const fingerprint =
      typeof globalThis?.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : Math.random().toString(36).slice(2, 12);
    const companyId = req.authUser?.companyId || req.authUser?._id || null;

    const instrument = await Instrument.create({
      name,
      category: payload.category,
      company,
      status: payload.status || "Active",
      fingerprint,
      companyId,
    });

    res.status(201).json({ instrument });
  } catch (error) {
    console.error("createInstrument error", error);
    res.status(500).json({ error: error.message });
  }
}

export async function updateInstrument(req, res) {
  try {
    const instrument = await Instrument.findById(req.params.id);
    if (!instrument)
      return res.status(404).json({ error: "Instrument not found" });

    const payload = normalizeInstrumentPayload(req.body);
    const name = payload.name;
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!payload.category)
      return res.status(400).json({ error: "Category is required" });

    const duplicate = await Instrument.findOne({
      _id: { $ne: instrument._id },
      name: new RegExp("^" + escapeRegex(name) + "$", "i"),
      category: new RegExp("^" + escapeRegex(payload.category) + "$", "i"),
      company: new RegExp("^" + escapeRegex(payload.company || "") + "$", "i"),
    });
    if (duplicate)
      return res.status(409).json({ error: "Instrument already exists" });

    // Only allow updating name, category and company. Status is managed internally.
    instrument.name = name;
    instrument.category = payload.category;
    if (payload.company) instrument.company = payload.company;
    await instrument.save();

    res.json({ instrument });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteInstrument(req, res) {
  try {
    const instrument = await Instrument.findById(req.params.id);
    if (!instrument)
      return res.status(404).json({ error: "Instrument not found" });

    // Check if the instrument name is referenced in any panel technical specs
    const nameRegex = new RegExp(escapeRegex(instrument.name), "i");

    const panelUsage = await Panel.findOne({
      $or: [
        { "technicalSpecs.relay": nameRegex },
        { "technicalSpecs.contactor": nameRegex },
        { "technicalSpecs.mccb": nameRegex },
        { "technicalSpecs.mcb": nameRegex },
        { "technicalSpecs.tpBreaker": nameRegex },
        { "technicalSpecs.spBreaker": nameRegex },
        { "technicalSpecs.fuseRating": nameRegex },
      ],
    });

    if (panelUsage) {
      instrument.status = "Inactive";
      await instrument.save();
      return res.json({
        ok: true,
        message: "Instrument marked Inactive (in use by panels)",
      });
    }

    await Instrument.findByIdAndDelete(instrument._id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function importInstruments(req, res) {
  try {
    let content = "";
    if (req.file && req.file.buffer) {
      content = req.file.buffer.toString("utf8");
    } else {
      content = req.body?.content || "";
    }

    const rows = parseImportRows(content);
    const isStreaming = req.headers.accept?.includes("text/event-stream");

    if (isStreaming) {
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const { created, duplicateRecords, invalidRecords } =
        await processImportRows(rows, {
          req,
          batchSize: 50,
          onProgress: async (payload) => {
            await streamImportProgress(res, payload, "progress");
          },
        });

      const finalPayload = {
        success: true,
        processed: rows.length,
        inserted: created.length,
        duplicates: duplicateRecords.filter(
          (record) => record.reason === "Already Exists",
        ).length,
        invalid: invalidRecords.length,
        created,
        duplicateRecords,
        invalidRecords,
      };

      await streamImportProgress(res, finalPayload, "done");
      res.end();
      return;
    }

    const { created, duplicateRecords, invalidRecords } =
      await processImportRows(rows, {
        req,
        batchSize: 50,
        onProgress: async () => undefined,
      });

    res.json({
      success: true,
      processed: rows.length,
      inserted: created.length,
      duplicates: duplicateRecords.filter(
        (record) => record.reason === "Already Exists",
      ).length,
      invalid: invalidRecords.length,
      created,
      duplicateRecords,
      invalidRecords,
    });
  } catch (error) {
    if (req.headers.accept?.includes("text/event-stream")) {
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      streamImportProgress(res, { error: error.message }, "error");
      res.end();
      return;
    }
    res.status(500).json({ error: error.message });
  }
}

export async function aiImportInstruments(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "Gemini API key is not configured" });
    }
    // Accept uploaded file or content
    let content = "";
    if (req.file && req.file.buffer) {
      content = req.file.buffer.toString("utf8");
    } else {
      content = req.body?.content || "";
    }
    const prompt = `Extract instrument master entries from the following text. Return JSON with an array named instruments where each object has only: category, company, name. Example: [{"category":"Relay","company":"Schneider","name":"RXM2AB2BD"}]\n\n${content}`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || "Gemini request failed");
    }

    const data = await response.json();
    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed = {};
    try {
      parsed = JSON.parse(resultText);
    } catch (e) {
      try {
        // sometimes model returns bare array
        parsed = { instruments: JSON.parse(resultText.trim()) };
      } catch (e2) {
        return res.status(500).json({ error: "Invalid JSON from Gemini" });
      }
    }
    const rows = parsed?.instruments || [];
    const isStreaming = req.headers.accept?.includes("text/event-stream");

    if (isStreaming) {
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const { created, duplicateRecords, invalidRecords } =
        await processImportRows(rows, {
          req,
          batchSize: 50,
          onProgress: async (payload) => {
            await streamImportProgress(res, payload, "progress");
          },
        });

      const finalPayload = {
        success: true,
        total: rows.length,
        processed: rows.length,
        inserted: created.length,
        duplicates: duplicateRecords.filter(
          (record) => record.reason === "Already Exists",
        ).length,
        invalid: invalidRecords.length,
        created,
        duplicateRecords,
        invalidRecords,
      };

      await streamImportProgress(res, finalPayload, "done");
      res.end();
      return;
    }

    const { created, duplicateRecords, invalidRecords } =
      await processImportRows(rows, {
        req,
        batchSize: 50,
        onProgress: async () => undefined,
      });

    res.json({
      success: true,
      total: rows.length,
      processed: rows.length,
      inserted: created.length,
      duplicates: duplicateRecords.filter(
        (record) => record.reason === "Already Exists",
      ).length,
      invalid: invalidRecords.length,
      created,
      duplicateRecords,
      invalidRecords,
    });
  } catch (error) {
    if (req.headers.accept?.includes("text/event-stream")) {
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      streamImportProgress(res, { error: error.message }, "error");
      res.end();
      return;
    }
    res.status(500).json({ error: error.message });
  }
}

export async function deleteAllInstruments(req, res) {
  try {
    // Only super_admin routed here via middleware
    await Instrument.deleteMany({});
    res.json({ ok: true, message: "All instruments deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
