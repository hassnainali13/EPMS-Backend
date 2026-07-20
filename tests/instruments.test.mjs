import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInstrumentFingerprint,
  normalizeInstrumentPayload,
  parseImportRows,
} from "../src/utils/instrumentUtils.js";

test("normalizes manufacturer and model into a stable fingerprint", () => {
  assert.equal(
    normalizeInstrumentFingerprint("Schneider", " A9F  "),
    "schneider|a9f",
  );
});

test("normalizes payload fields and trims optional values", () => {
  const payload = normalizeInstrumentPayload({
    name: " MCCB ",
    category: " Breaker ",
    manufacturer: "Schneider",
    modelNumber: "A9F",
    voltage: " 415V ",
    current: " 100A ",
    status: "Active",
  });

  assert.equal(payload.name, "MCCB");
  assert.equal(payload.category, "Breaker");
  assert.equal(payload.voltage, "415V");
  assert.equal(payload.current, "100A");
});

test("parses simple CSV content into instrument rows", () => {
  const rows = parseImportRows(
    "name,category,manufacturer,modelNumber,rating,voltage,current,status\nMCCB,Breaker,Schneider,A9F,100A,415V,100A,Active",
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "MCCB");
  assert.equal(rows[0].manufacturer, "Schneider");
});
