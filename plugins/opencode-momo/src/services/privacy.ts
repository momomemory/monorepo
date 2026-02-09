export function stripPrivateContent(text: string): string {
  if (!text) return "";
  // Remove all <private>...</private> blocks, including multiline content
  return text.replace(/<private>[\s\S]*?<\/private>/g, "").trim();
}

export function isFullyPrivate(text: string): boolean {
  const stripped = stripPrivateContent(text);
  return stripped.length === 0;
}

export default { stripPrivateContent, isFullyPrivate };
