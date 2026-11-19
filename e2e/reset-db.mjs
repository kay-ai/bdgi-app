// Removes the end-to-end database so every run starts from a clean seed.
import { rmSync } from "node:fs";

const dir = process.env.PGLITE_DIR;
if (!dir || !dir.includes("e2e")) {
  console.error("reset-db: refusing to delete a PGLITE_DIR that is not the e2e one");
  process.exit(1);
}
rmSync(dir, { recursive: true, force: true });
