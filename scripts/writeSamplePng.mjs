import fs from "fs";
const base64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAn8B9o+0VQAAAABJRU5ErkJggg==";
fs.writeFileSync("scripts/sample.png", Buffer.from(base64, "base64"));
console.log("Wrote scripts/sample.png");
