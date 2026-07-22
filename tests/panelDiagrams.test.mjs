import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Panel from "../src/models/Panel.js";

test("panel diagrams validation rejects more than five diagrams", () => {
  const panel = new Panel({
    panelId: "TEST24-MCC-0001",
    panelName: "Test Panel",
    company: new mongoose.Types.ObjectId(),
    companyId: new mongoose.Types.ObjectId(),
    diagrams: Array.from({ length: 6 }, (_, index) => ({
      name: `Diagram ${index + 1}`,
      url: `https://example.com/diagram-${index + 1}.pdf`,
      publicId: `diagram-${index + 1}`,
      fileType: "pdf",
    })),
  });

  const error = panel.validateSync();
  assert.ok(error);
  assert.match(error.message, /at most 5 wiring diagrams/i);
});
