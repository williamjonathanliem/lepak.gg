// Images on the whiteboard. Each picture is shrunk before it's saved or shared, so boards
// stay small: longest side at most MAX_SIDE px, WebP (or JPEG/PNG where WebP isn't there).
// Solo boards keep pictures in this browser's IndexedDB; shared boards send them through
// Firebase once (see net/boardSync.ts).

import type { BinaryFileData, BinaryFiles } from '@excalidraw/excalidraw/types';

const MAX_SIDE = 1280;
/** Biggest picture we share, as data URL text. Matches database.rules.json. */
export const MAX_IMAGE_CHARS = 700_000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Smaller copy of a picture, or null if it can't be made small enough. */
export async function shrinkImage(file: BinaryFileData): Promise<BinaryFileData | null> {
  if (file.dataURL.length <= MAX_IMAGE_CHARS / 2 && !file.mimeType.includes('svg')) return file;
  try {
    const img = await loadImage(file.dataURL);
    for (const [side, quality] of [
      [MAX_SIDE, 0.8],
      [1024, 0.7],
      [768, 0.6],
    ] as const) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataURL = canvas.toDataURL('image/webp', quality);
      if (dataURL.length <= MAX_IMAGE_CHARS) {
        const mimeType = dataURL.slice(5, dataURL.indexOf(';')) as BinaryFileData['mimeType'];
        return { ...file, dataURL: dataURL as BinaryFileData['dataURL'], mimeType };
      }
    }
  } catch {
    // unreadable picture
  }
  return null;
}

// ---------- solo boards: IndexedDB ----------

const DB_NAME = 'lepak-whiteboard';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSoloFiles(): Promise<BinaryFileData[]> {
  try {
    const db = await openDb();
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as BinaryFileData[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Saves new pictures and forgets ones no shape uses any more. */
export async function saveSoloFiles(files: BinaryFiles, usedIds: ReadonlySet<string>) {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const have = new Set(keys.map(String));
    for (const id of have) if (!usedIds.has(id)) store.delete(id);
    for (const [id, file] of Object.entries(files)) {
      if (usedIds.has(id) && !have.has(id)) store.put(file, id);
    }
    await done(tx);
  } catch {
    // storage full or blocked: the drawing still saves, just not the picture
  }
}
