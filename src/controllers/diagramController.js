import Diagram from "../models/Diagram.js";
import { normalizeDiagramPayload } from "../utils/diagramUtils.js";

function buildDiagramResponse(diagram) {
  const obj = diagram.toObject ? diagram.toObject() : diagram;
  return {
    ...obj,
    id: obj._id?.toString?.() || obj.id || obj._id,
  };
}

export async function listDiagrams(req, res) {
  try {
    const companyId = req.authUser?.company?._id;
    if (!companyId) {
      return res.status(400).json({ error: "Company context is required." });
    }

    const { search = "" } = req.query;
    const filter = { companyId };
    if (search) {
      filter.name = new RegExp(String(search), "i");
    }

    const diagrams = await Diagram.find(filter).sort({ createdAt: -1 });
    res.json({ diagrams: diagrams.map(buildDiagramResponse) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createDiagram(req, res) {
  try {
    const companyId = req.authUser?.company?._id;
    if (!companyId) {
      return res.status(400).json({ error: "Company context is required." });
    }

    const payload = normalizeDiagramPayload(req.body);
    const diagram = await Diagram.create({
      company: companyId,
      companyId,
      createdBy: req.authUser?._id || null,
      updatedBy: req.authUser?._id || null,
      ...payload,
    });

    res.status(201).json({ diagram: buildDiagramResponse(diagram) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateDiagram(req, res) {
  try {
    const companyId = req.authUser?.company?._id;
    const diagramId = req.params.id;
    if (!companyId) {
      return res.status(400).json({ error: "Company context is required." });
    }

    const payload = normalizeDiagramPayload(req.body);
    const diagram = await Diagram.findOneAndUpdate(
      { _id: diagramId, companyId },
      {
        $set: {
          ...payload,
          updatedBy: req.authUser?._id || null,
        },
      },
      { new: true },
    );

    if (!diagram) {
      return res.status(404).json({ error: "Diagram not found" });
    }

    res.json({ diagram: buildDiagramResponse(diagram) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteDiagram(req, res) {
  try {
    const companyId = req.authUser?.company?._id;
    const diagramId = req.params.id;
    if (!companyId) {
      return res.status(400).json({ error: "Company context is required." });
    }

    const diagram = await Diagram.findOneAndDelete({
      _id: diagramId,
      companyId,
    });
    if (!diagram) {
      return res.status(404).json({ error: "Diagram not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
