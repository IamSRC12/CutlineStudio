import { Document, ProjectSettings } from "@/shared/schema";

const DB_NAME = "LyricSplitStudioDB";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not available"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("documents")) {
        db.createObjectStore("documents", { keyPath: "projectId" });
      }
      if (!db.objectStoreNames.contains("peaks")) {
        db.createObjectStore("peaks", { keyPath: "sha256" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCrashMirror(
  projectId: string,
  doc: Document,
  settings: ProjectSettings
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("documents", "readwrite");
    const store = tx.objectStore("documents");
    store.put({
      projectId,
      doc,
      settings,
      savedAt: Date.now(),
    });
  } catch (err) {
    console.warn("Failed to save to IndexedDB crash mirror:", err);
  }
}

export async function loadCrashMirror(
  projectId: string
): Promise<{ doc: Document; settings: ProjectSettings } | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction("documents", "readonly");
      const store = tx.objectStore("documents");
      const req = store.get(projectId);
      req.onsuccess = () => {
        if (req.result) {
          resolve({ doc: req.result.doc, settings: req.result.settings });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function cacheWaveformPeaks(sha256: string, peaks: Float32Array): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("peaks", "readwrite");
    const store = tx.objectStore("peaks");
    store.put({
      sha256,
      peaks: Array.from(peaks),
      savedAt: Date.now(),
    });
  } catch (err) {
    console.warn("Failed to cache waveform peaks:", err);
  }
}

export async function getCachedWaveformPeaks(sha256: string): Promise<Float32Array | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction("peaks", "readonly");
      const store = tx.objectStore("peaks");
      const req = store.get(sha256);
      req.onsuccess = () => {
        if (req.result?.peaks) {
          resolve(new Float32Array(req.result.peaks));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
