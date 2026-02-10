import os from "node:os";
import { basename } from "node:path";

export function simpleHash(input: string): string {
  // djb2-like hash, deterministic and simple
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  // Convert to positive 32-bit integer and hex
  return (h >>> 0).toString(16);
}

export function userTag(): string {
  const username = os.userInfo().username || "unknown";
  return `opencode-user-${simpleHash(username)}`;
}

export function projectTag(directory: string): string {
  const dir = directory || ".";
  const projectName = basename(dir.replace(/[\\/]+$/, ""));
  const slug = slugify(projectName) || "project";
  const hash = shortHash(dir);
  return `ocp-${slug}-${hash}`;
}

export function getTags(directory: string): { user: string; project: string } {
  return { user: userTag(), project: projectTag(directory) };
}

export function getTagsWithOverrides(
  directory: string,
  overrides?: { containerTagUser?: string; containerTagProject?: string }
): { user: string; project: string } {
  const tags = getTags(directory);
  if (overrides?.containerTagUser) tags.user = overrides.containerTagUser;
  if (overrides?.containerTagProject) tags.project = overrides.containerTagProject;
  return tags;
}

function shortHash(input: string): string {
  return simpleHash(input).padStart(8, "0").slice(-8);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default { getTags, getTagsWithOverrides, userTag, projectTag };
