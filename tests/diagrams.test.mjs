import test from "node:test";
import assert from "node:assert/strict";
import {
  findOrCreateDiagramForCompany,
  normalizeDiagramPayload,
} from "../src/utils/diagramUtils.js";

test("normalizes diagram payloads and preserves library references", () => {
  const payload = normalizeDiagramPayload({
    name: " Main Wiring ",
    url: "https://example.com/diagram.png",
    publicId: "epms/diagram-1",
    fileType: "image/png",
    libraryId: "64f0b4e2f0a1b2c3d4e5f678",
  });

  assert.equal(payload.name, "Main Wiring");
  assert.equal(payload.url, "https://example.com/diagram.png");
  assert.equal(payload.libraryId, "64f0b4e2f0a1b2c3d4e5f678");
  assert.equal(payload.source, "library");
});

test("reuses an existing company diagram when the same file is uploaded again", async () => {
  const existing = {
    _id: "64f0b4e2f0a1b2c3d4e5f678",
    companyId: "company-1",
    name: "Main Wiring",
    url: "https://example.com/diagram.png",
    publicId: "epms/diagram-1",
    fileType: "image/png",
    source: "upload",
  };

  const findOne = async () => existing;
  const create = async () => {
    throw new Error("create should not be called");
  };

  const result = await findOrCreateDiagramForCompany(
    { companyId: "company-1", name: "Main Wiring", url: "https://example.com/diagram.png", publicId: "epms/diagram-1", fileType: "image/png" },
    { findOne, create },
  );

  assert.equal(result._id, existing._id);
});
