import { execSync } from "child_process";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";

const ROOT = dirname(import.meta.dirname!); // sdks/typescript/
const OPENAPI_PATH = resolve(ROOT, "openapi/openapi.json");
const GENERATED_DIR = resolve(ROOT, "src/generated");

// Ensure generated directory exists
mkdirSync(GENERATED_DIR, { recursive: true });

// Step 1: Run openapi-typescript to generate schema.ts
console.log("Generating types from OpenAPI spec...");
execSync(
  `npx openapi-typescript ${OPENAPI_PATH} -o ${resolve(GENERATED_DIR, "schema.ts")}`,
  { stdio: "inherit", cwd: ROOT }
);

console.log("Codegen complete.");
