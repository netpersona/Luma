import AdmZip from 'adm-zip';
import { parseFile } from 'music-metadata';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { extractDominantColors } from './metadata';

export interface AudioTrackInfo {
  filename: string;
  title: string;
  trackIndex: number;
  duration: number;
  fileSize: number;
  bitrate?: number;
  tempPath?: string;
}

export interface MultiFileAudiobookPreview {
  title: string;
  author: string;
  narrator?: string;
  description?: string;
  publisher?: string;
  series?: string;
  seriesIndex?: number;
  totalDuration: number;
  totalSize: number;
  trackCount: number;
  tracks: AudioTrackInfo[];
  coverData?: Buffer;
  coverMimeType?: string;
  tempDir: string;
}

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.m4b', '.ogg', '.opus', '.flac', '.aac'];

function isAudioFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext);
}

function naturalSort(a: string, b: string): number {
  const numRegex = /(\d+)/g;
  const aNum = a.match(numRegex) || [];
  const bNum = b.match(numRegex) || [];
  
  const parseIntOrMax = (str: string | undefined) => 
    str ? parseInt(str, 10) : Number.MAX_SAFE_INTEGER;
  
  for (let i = 0; i < Math.max(aNum.length, bNum.length); i++) {
    const aVal = parseIntOrMax(aNum[i]);
    const bVal = parseIntOrMax(bNum[i]);
    if (aVal !== bVal) return aVal - bVal;
  }
  
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export async function extractZipAudiobook(
  zipBuffer: Buffer,
  originalFilename: string
): Promise<MultiFileAudiobookPreview> {
  const tempDir = `/tmp/audiobook-import-${uuidv4()}`;
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    
    const audioFiles: Array<{ name: string; entry: any }> = [];
    let coverEntry: any = null;
    
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      
      const filename = path.basename(entry.entryName);
      const ext = path.extname(filename).toLowerCase();
      
      if (isAudioFile(filename)) {
        audioFiles.push({ name: entry.entryName, entry });
      }
      
      if (!coverEntry && ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        const lowerName = filename.toLowerCase();
        if (lowerName.includes('cover') || lowerName.includes('folder') || lowerName.includes('album')) {
          coverEntry = entry;
        }
      }
    }
    
    if (!coverEntry) {
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const ext = path.extname(entry.entryName).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          coverEntry = entry;
          break;
        }
      }
    }
    
    if (audioFiles.length === 0) {
      throw new Error('No audio files found in the zip archive');
    }
    
    audioFiles.sort((a, b) => naturalSort(a.name, b.name));
    
    const tracks: AudioTrackInfo[] = [];
    let totalDuration = 0;
    let totalSize = 0;
    let title = '';
    let author = '';
    let narrator = '';
    let description = '';
    let publisher = '';
    let series = '';
    let seriesIndex: number | undefined;
    let coverData: Buffer | undefined;
    let coverMimeType: string | undefined;
    
    for (let i = 0; i < audioFiles.length; i++) {
      const { name, entry } = audioFiles[i];
      const filename = path.basename(name);
      const tempPath = path.join(tempDir, `track_${i.toString().padStart(3, '0')}_${filename}`);
      
      zip.extractEntryTo(entry, tempDir, false, true, false, `track_${i.toString().padStart(3, '0')}_${filename}`);
      
      try {
        const metadata = await parseFile(tempPath);
        const duration = metadata.format.duration || 0;
        const fileSize = fs.statSync(tempPath).size;
        const bitrate = metadata.format.bitrate;
        
        const trackTitle = metadata.common.title || 
          filename.replace(/\.[^.]+$/, '').replace(/^[\d_\-\s]+/, '').trim() ||
          `Track ${i + 1}`;
        
        tracks.push({
          filename,
          title: trackTitle,
          trackIndex: i,
          duration,
          fileSize,
          bitrate,
          tempPath
        });
        
        totalDuration += duration;
        totalSize += fileSize;
        
        if (i === 0) {
          title = metadata.common.album || '';
          author = metadata.common.artist || metadata.common.albumartist || '';
          narrator = Array.isArray(metadata.common.composer) 
            ? metadata.common.composer[0] 
            : (metadata.common.composer || '');
          publisher = Array.isArray(metadata.common.label)
            ? metadata.common.label[0]
            : (metadata.common.label || '');
          
          if (metadata.common.comment) {
            description = typeof metadata.common.comment === 'string'
              ? metadata.common.comment
              : ((metadata.common.comment as any).text || String(metadata.common.comment));
          }
          
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            coverData = Buffer.from(metadata.common.picture[0].data);
            coverMimeType = metadata.common.picture[0].format;
          }
        }
      } catch (err) {
        console.error(`Error extracting metadata from ${filename}:`, err);
        const fileSize = fs.statSync(tempPath).size;
        tracks.push({
          filename,
          title: filename.replace(/\.[^.]+$/, ''),
          trackIndex: i,
          duration: 0,
          fileSize,
          tempPath
        });
        totalSize += fileSize;
      }
    }
    
    if (!title) {
      const zipName = originalFilename.replace(/\.zip$/i, '');
      const authorMatch = zipName.match(/^(.+?)\s*[-–—]\s*(.+)$/);
      if (authorMatch) {
        author = authorMatch[1].trim();
        title = authorMatch[2].trim();
      } else {
        title = zipName;
      }
    }
    
    if (coverEntry && !coverData) {
      coverData = coverEntry.getData();
      const ext = path.extname(coverEntry.entryName).toLowerCase();
      coverMimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    }
    
    return {
      title,
      author,
      narrator: narrator || undefined,
      description: description || undefined,
      publisher: publisher || undefined,
      series: series || undefined,
      seriesIndex,
      totalDuration: Math.round(totalDuration),
      totalSize,
      trackCount: tracks.length,
      tracks,
      coverData,
      coverMimeType,
      tempDir
    };
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export async function extractFolderAudiobook(
  folderPath: string
): Promise<MultiFileAudiobookPreview> {
  const tempDir = `/tmp/audiobook-import-${uuidv4()}`;
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    const files = fs.readdirSync(folderPath);
    const audioFiles: string[] = [];
    let coverPath: string | null = null;
    
    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isFile()) {
        if (isAudioFile(file)) {
          audioFiles.push(file);
        }
        
        const ext = path.extname(file).toLowerCase();
        if (!coverPath && ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          const lowerName = file.toLowerCase();
          if (lowerName.includes('cover') || lowerName.includes('folder') || lowerName.includes('album')) {
            coverPath = fullPath;
          }
        }
      }
    }
    
    if (!coverPath) {
      for (const file of files) {
        const fullPath = path.join(folderPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            coverPath = fullPath;
            break;
          }
        }
      }
    }
    
    if (audioFiles.length === 0) {
      throw new Error('No audio files found in the folder');
    }
    
    audioFiles.sort(naturalSort);
    
    const tracks: AudioTrackInfo[] = [];
    let totalDuration = 0;
    let totalSize = 0;
    let title = '';
    let author = '';
    let narrator = '';
    let description = '';
    let publisher = '';
    let coverData: Buffer | undefined;
    let coverMimeType: string | undefined;
    
    for (let i = 0; i < audioFiles.length; i++) {
      const filename = audioFiles[i];
      const sourcePath = path.join(folderPath, filename);
      const tempPath = path.join(tempDir, `track_${i.toString().padStart(3, '0')}_${filename}`);
      
      fs.copyFileSync(sourcePath, tempPath);
      
      try {
        const metadata = await parseFile(tempPath);
        const duration = metadata.format.duration || 0;
        const fileSize = fs.statSync(tempPath).size;
        const bitrate = metadata.format.bitrate;
        
        const trackTitle = metadata.common.title || 
          filename.replace(/\.[^.]+$/, '').replace(/^[\d_\-\s]+/, '').trim() ||
          `Track ${i + 1}`;
        
        tracks.push({
          filename,
          title: trackTitle,
          trackIndex: i,
          duration,
          fileSize,
          bitrate,
          tempPath
        });
        
        totalDuration += duration;
        totalSize += fileSize;
        
        if (i === 0) {
          title = metadata.common.album || '';
          author = metadata.common.artist || metadata.common.albumartist || '';
          narrator = Array.isArray(metadata.common.composer)
            ? metadata.common.composer[0]
            : (metadata.common.composer || '');
          publisher = Array.isArray(metadata.common.label)
            ? metadata.common.label[0]
            : (metadata.common.label || '');
          
          if (metadata.common.comment) {
            description = typeof metadata.common.comment === 'string'
              ? metadata.common.comment
              : ((metadata.common.comment as any).text || String(metadata.common.comment));
          }
          
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            coverData = Buffer.from(metadata.common.picture[0].data);
            coverMimeType = metadata.common.picture[0].format;
          }
        }
      } catch (err) {
        console.error(`Error extracting metadata from ${filename}:`, err);
        const fileSize = fs.statSync(tempPath).size;
        tracks.push({
          filename,
          title: filename.replace(/\.[^.]+$/, ''),
          trackIndex: i,
          duration: 0,
          fileSize,
          tempPath
        });
        totalSize += fileSize;
      }
    }
    
    if (!title) {
      title = path.basename(folderPath);
    }
    
    if (coverPath && !coverData) {
      coverData = fs.readFileSync(coverPath);
      const ext = path.extname(coverPath).toLowerCase();
      coverMimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    }
    
    return {
      title,
      author,
      narrator: narrator || undefined,
      description: description || undefined,
      publisher: publisher || undefined,
      totalDuration: Math.round(totalDuration),
      totalSize,
      trackCount: tracks.length,
      tracks,
      coverData,
      coverMimeType,
      tempDir
    };
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export function cleanupTempDir(tempDir: string): void {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Error cleaning up temp directory ${tempDir}:`, err);
  }
}

export async function processAndSaveCover(
  coverData: Buffer,
  audiobookId: string,
  dataDir: string
): Promise<{ coverUrl: string; dominantColors: string[] }> {
  const coversDir = path.join(dataDir, 'covers');
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }
  
  const optimizedCover = await sharp(coverData)
    .resize(600, 900, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  
  const coverFilename = `${audiobookId}.webp`;
  const coverPath = path.join(coversDir, coverFilename);
  fs.writeFileSync(coverPath, optimizedCover);
  
  const dominantColors = await extractDominantColors(optimizedCover);
  
  return {
    coverUrl: `/local-files/covers/${coverFilename}`,
    dominantColors
  };
}

export async function saveAudiobookTracks(
  preview: MultiFileAudiobookPreview,
  audiobookId: string,
  dataDir: string
): Promise<Array<{ trackIndex: number; filePath: string; fileSize: number; duration: number; bitrate?: number; title: string }>> {
  const audiobooksDir = path.join(dataDir, 'audiobooks', audiobookId);
  if (!fs.existsSync(audiobooksDir)) {
    fs.mkdirSync(audiobooksDir, { recursive: true });
  }
  
  const savedTracks: Array<{ 
    trackIndex: number; 
    filePath: string; 
    fileSize: number; 
    duration: number; 
    bitrate?: number;
    title: string;
  }> = [];
  
  for (const track of preview.tracks) {
    if (!track.tempPath) continue;
    
    const ext = path.extname(track.filename);
    const destFilename = `${track.trackIndex.toString().padStart(3, '0')}_${track.filename}`;
    const destPath = path.join(audiobooksDir, destFilename);
    
    fs.copyFileSync(track.tempPath, destPath);
    
    savedTracks.push({
      trackIndex: track.trackIndex,
      filePath: `/local-files/audiobooks/${audiobookId}/${destFilename}`,
      fileSize: track.fileSize,
      duration: track.duration,
      bitrate: track.bitrate,
      title: track.title
    });
  }
  
  return savedTracks;
}
