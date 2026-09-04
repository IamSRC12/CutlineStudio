import fs from "fs";
import path from "path";
import crypto from "crypto";

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "storage");

// Ensure storage directory exists
export function ensureStorageDir(): string {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  return STORAGE_DIR;
}

export function getAssetPath(assetId: string, ext: string = ".bin"): string {
  const dir = ensureStorageDir();
  return path.join(dir, `${assetId}${ext}`);
}

export function calculateSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
