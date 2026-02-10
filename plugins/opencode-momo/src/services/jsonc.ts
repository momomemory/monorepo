/**
 * Remove JSONC comments and trailing commas.
 *
 * This parser is intentionally lightweight and keeps string literals intact,
 * including escaped quotes and URLs.
 */
export function stripJsoncComments(input: string): string {
  enum Mode {
    Code,
    String,
    LineComment,
    BlockComment,
  }

  const out: string[] = [];
  let mode = Mode.Code;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    const next = input[i + 1];

    if (mode === Mode.String) {
      out.push(ch);

      if (ch === "\\") {
        // Keep escape + escaped char together.
        if (next !== undefined) {
          out.push(next);
          i++;
        }
        continue;
      }

      if (ch === '"') {
        mode = Mode.Code;
      }

      continue;
    }

    if (mode === Mode.LineComment) {
      if (ch === "\n") {
        mode = Mode.Code;
        out.push("\n");
      }
      continue;
    }

    if (mode === Mode.BlockComment) {
      if (ch === "*" && next === "/") {
        mode = Mode.Code;
        i++;
        continue;
      }

      if (ch === "\n") {
        out.push("\n");
      }

      continue;
    }

    // Mode.Code
    if (ch === '"') {
      mode = Mode.String;
      out.push(ch);
      continue;
    }

    if (ch === "/" && next === "/") {
      mode = Mode.LineComment;
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      mode = Mode.BlockComment;
      i++;
      continue;
    }

    out.push(ch);
  }

  // Remove trailing commas before object/array close.
  return out.join("").replace(/,\s*([}\]])/g, "$1");
}
