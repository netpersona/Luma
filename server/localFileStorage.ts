import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Response } from 'express';

function getFilesDir(): string {
  if (process.env.FILES_DIR) {
    return process.env.FILES_DIR;
  }
  if (process.env.NODE_ENV === 'production' && fs.existsSync('/data')) {
    return '/data';
  }
  return path.join(process.cwd(), 'data');
}

export const filesDir = getFilesDir();

console.log(`[LocalStorage] Using files directory: ${filesDir}`);

export function getLocalStorageDir(subdir: 'books' | 'audiobooks' | 'covers' | 'uploads'): string {
  const dir = path.join(filesDir, subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function saveLocalFile(
  data: Buffer,
  subdir: 'books' | 'audiobooks' | 'covers' | 'uploads',
  extension: string
): Promise<string> {
  const dir = getLocalStorageDir(subdir);
  const filename = `${randomUUID()}${extension.startsWith('.') ? extension : `.${extension}`}`;
  const filePath = path.join(dir, filename);
  
  await fs.promises.writeFile(filePath, data);
  
  return `/local-files/${subdir}/${filename}`;
}

export async function saveLocalFileWithName(
  data: Buffer,
  subdir: 'books' | 'audiobooks' | 'covers' | 'uploads',
  filename: string
): Promise<string> {
  const dir = getLocalStorageDir(subdir);
  const safeFilename = `${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = path.join(dir, safeFilename);
  
  await fs.promises.writeFile(filePath, data);
  
  return `/local-files/${subdir}/${safeFilename}`;
}

export function getAbsoluteFilePath(localPath: string): string | null {
  if (!localPath) return null;
  
  if (!localPath.startsWith('/local-files/')) {
    return null;
  }
  
  const relativePath = localPath.replace('/local-files/', '');
  const fullPath = path.join(filesDir, relativePath);
  
  const normalizedFilesDir = path.resolve(filesDir);
  const normalizedFullPath = path.resolve(fullPath);
  if (!normalizedFullPath.startsWith(normalizedFilesDir)) {
    console.error('Security: Path traversal attempt detected');
    return null;
  }
  
  return fullPath;
}

export async function getLocalFilePath(localPath: string): Promise<string | null> {
  const fullPath = getAbsoluteFilePath(localPath);
  if (!fullPath) return null;
  
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  
  return fullPath;
}

export async function localFileExists(localPath: string): Promise<boolean> {
  const fullPath = await getLocalFilePath(localPath);
  return fullPath !== null;
}

export async function deleteLocalFile(localPath: string): Promise<boolean> {
  const fullPath = await getLocalFilePath(localPath);
  if (!fullPath) {
    return false;
  }
  
  try {
    await fs.promises.unlink(fullPath);
    return true;
  } catch (error) {
    console.error('Error deleting local file:', error);
    return false;
  }
}

export function getFileExtension(filename: string, contentType?: string): string {
  if (filename && filename.includes('.')) {
    return path.extname(filename);
  }
  
  if (contentType) {
    if (contentType.includes('epub')) return '.epub';
    if (contentType.includes('pdf')) return '.pdf';
    if (contentType.includes('mobi') || contentType.includes('mobipocket')) return '.mobi';
    if (contentType.includes('cbz')) return '.cbz';
    if (contentType.includes('cbr')) return '.cbr';
    if (contentType.includes('m4b')) return '.m4b';
    if (contentType.includes('mp3') || contentType.includes('mpeg')) return '.mp3';
    if (contentType.includes('m4a') || contentType.includes('mp4')) return '.m4a';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
    if (contentType.includes('png')) return '.png';
    if (contentType.includes('webp')) return '.webp';
    if (contentType.includes('gif')) return '.gif';
  }
  
  return '.bin';
}

export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.epub': 'application/epub+zip',
    '.pdf': 'application/pdf',
    '.mobi': 'application/x-mobipocket-ebook',
    '.cbz': 'application/x-cbz',
    '.cbr': 'application/x-cbr',
    '.m4b': 'audio/mp4',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.bin': 'application/octet-stream',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

export async function streamLocalFile(localPath: string, res: Response): Promise<boolean> {
  const fullPath = await getLocalFilePath(localPath);
  if (!fullPath) {
    return false;
  }
  
  try {
    const stat = await fs.promises.stat(fullPath);
    const contentType = getContentType(fullPath);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
    return true;
  } catch (error) {
    console.error('Error streaming local file:', error);
    return false;
  }
}

export async function readLocalFile(localPath: string): Promise<Buffer | null> {
  const fullPath = await getLocalFilePath(localPath);
  if (!fullPath) {
    return null;
  }
  
  try {
    return await fs.promises.readFile(fullPath);
  } catch (error) {
    console.error('Error reading local file:', error);
    return null;
  }
}

export function generateUploadId(): string {
  return randomUUID();
}
