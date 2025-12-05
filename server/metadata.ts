import EPub from "epub";
import { parseFile } from "music-metadata";
import { File } from "@google-cloud/storage";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import sharp from "sharp";
import ColorThief from "colorthief";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export interface AudioChapter {
  title: string;
  startTime: number; // in seconds
  endTime?: number; // in seconds
}

export interface ExtractedMetadata {
  title?: string;
  author?: string;
  narrator?: string;
  publisher?: string;
  publishedYear?: number;
  duration?: number;
  description?: string;
  isbn?: string;
  language?: string;
  series?: string;
  seriesNumber?: number;
  pageCount?: number;
  tags?: string[];
  coverImageData?: Buffer;
  dominantColors?: string[];
  chapters?: AudioChapter[];
}

// Convert RGB array to hex string
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// Calculate color distance (Euclidean in RGB space)
function colorDistance(c1: [number, number, number], c2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(c1[0] - c2[0], 2) +
    Math.pow(c1[1] - c2[1], 2) +
    Math.pow(c1[2] - c2[2], 2)
  );
}

// Check if a color is too close to white or very light
function isNearWhite(r: number, g: number, b: number): boolean {
  return r > 240 && g > 240 && b > 240;
}

// Check if a color is too close to pure black
function isNearBlack(r: number, g: number, b: number): boolean {
  return r < 15 && g < 15 && b < 15;
}

// ============================================================================
// LAB COLOR SPACE UTILITIES
// LAB is a perceptually uniform color space where distances correlate with
// how different colors appear to human vision
// ============================================================================

interface LABColor {
  L: number;  // Lightness: 0-100
  a: number;  // Green-Red: -128 to 127
  b: number;  // Blue-Yellow: -128 to 127
}

// Convert RGB (0-255) to XYZ color space (intermediate step to LAB)
function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  // Normalize to 0-1
  let rn = r / 255;
  let gn = g / 255;
  let bn = b / 255;
  
  // Apply gamma correction (sRGB to linear)
  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;
  
  // Scale to 0-100
  rn *= 100;
  gn *= 100;
  bn *= 100;
  
  // Apply transformation matrix (sRGB D65 illuminant)
  const x = rn * 0.4124564 + gn * 0.3575761 + bn * 0.1804375;
  const y = rn * 0.2126729 + gn * 0.7151522 + bn * 0.0721750;
  const z = rn * 0.0193339 + gn * 0.1191920 + bn * 0.9503041;
  
  return [x, y, z];
}

// Convert XYZ to LAB color space
function xyzToLab(x: number, y: number, z: number): LABColor {
  // D65 reference white point
  const refX = 95.047;
  const refY = 100.000;
  const refZ = 108.883;
  
  let xn = x / refX;
  let yn = y / refY;
  let zn = z / refZ;
  
  // Apply f(t) transformation
  const epsilon = 0.008856;
  const kappa = 903.3;
  
  xn = xn > epsilon ? Math.pow(xn, 1/3) : (kappa * xn + 16) / 116;
  yn = yn > epsilon ? Math.pow(yn, 1/3) : (kappa * yn + 16) / 116;
  zn = zn > epsilon ? Math.pow(zn, 1/3) : (kappa * zn + 16) / 116;
  
  const L = 116 * yn - 16;
  const a = 500 * (xn - yn);
  const b = 200 * (yn - zn);
  
  return { L, a, b };
}

// Convert RGB to LAB
function rgbToLab(r: number, g: number, b: number): LABColor {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

// Convert LAB to XYZ
function labToXyz(L: number, a: number, b: number): [number, number, number] {
  const refX = 95.047;
  const refY = 100.000;
  const refZ = 108.883;
  
  let yn = (L + 16) / 116;
  let xn = a / 500 + yn;
  let zn = yn - b / 200;
  
  const epsilon = 0.008856;
  const kappa = 903.3;
  
  const xn3 = Math.pow(xn, 3);
  const yn3 = Math.pow(yn, 3);
  const zn3 = Math.pow(zn, 3);
  
  xn = xn3 > epsilon ? xn3 : (116 * xn - 16) / kappa;
  yn = yn3 > epsilon ? yn3 : (116 * yn - 16) / kappa;
  zn = zn3 > epsilon ? zn3 : (116 * zn - 16) / kappa;
  
  return [xn * refX, yn * refY, zn * refZ];
}

// Convert XYZ to RGB
function xyzToRgb(x: number, y: number, z: number): [number, number, number] {
  // Scale down
  x /= 100;
  y /= 100;
  z /= 100;
  
  // Apply inverse transformation matrix
  let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
  let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  
  // Apply gamma correction (linear to sRGB)
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1/2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1/2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1/2.4) - 0.055 : 12.92 * b;
  
  // Clamp and scale to 0-255
  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(b * 255)))
  ];
}

// Convert LAB to RGB
function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const [x, y, z] = labToXyz(L, a, b);
  return xyzToRgb(x, y, z);
}

// Calculate Delta E (CIE76) - perceptual color difference
// Values: 0 = identical, <1 = imperceptible, 1-2 = slight, 2-10 = noticeable, >10 = obvious
function deltaE(lab1: LABColor, lab2: LABColor): number {
  return Math.sqrt(
    Math.pow(lab1.L - lab2.L, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

// Get perceptual hue angle from LAB (0-360 degrees)
function getLabHue(lab: LABColor): number {
  let hue = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
  if (hue < 0) hue += 360;
  return hue;
}

// Get chroma (colorfulness) from LAB
function getLabChroma(lab: LABColor): number {
  return Math.sqrt(lab.a * lab.a + lab.b * lab.b);
}

export async function extractDominantColors(imageBuffer: Buffer): Promise<string[]> {
  const tmpPath = `/tmp/cover-${Date.now()}.png`;
  let tmpFileCreated = false;
  
  try {
    // Convert to PNG and resize for faster processing
    await sharp(imageBuffer)
      .resize(200, 200, { fit: 'inside' })
      .png()
      .toFile(tmpPath);
    tmpFileCreated = true;
    
    // Get palette of dominant colors sorted by area coverage (MMCQ algorithm)
    // ColorThief returns colors sorted by how much of the image they represent
    const palette = await ColorThief.getPalette(tmpPath, 8);
    
    if (!palette || palette.length === 0) {
      return [];
    }
    
    // Filter and process colors
    const validColors: string[] = [];
    const addedColors: [number, number, number][] = [];
    
    // Count how many near-black colors are in the palette to decide if we should include them
    const nearBlackCount = palette.filter(([r, g, b]) => isNearBlack(r, g, b)).length;
    const includeNearBlack = nearBlackCount <= 2; // Only include near-black if it's not dominating
    
    for (const color of palette) {
      const [r, g, b] = color;
      
      // Skip colors that are too close to pure white (would wash out gradient)
      if (isNearWhite(r, g, b)) continue;
      
      // Skip near-black colors if they're dominating the palette
      if (!includeNearBlack && isNearBlack(r, g, b)) continue;
      
      // Skip colors too similar to already added colors (merge duplicates)
      const isTooSimilar = addedColors.some(
        existing => colorDistance(existing, [r, g, b]) < 40
      );
      if (isTooSimilar) continue;
      
      // Add the color
      validColors.push(rgbToHex(r, g, b));
      addedColors.push([r, g, b]);
      
      // Stop after we have 4 distinct colors
      if (validColors.length >= 4) break;
    }
    
    // Return top colors (ideally 3-4 for nice gradients)
    return validColors.slice(0, 4);
  } catch (error) {
    console.error("Error extracting colors from cover:", error);
    return [];
  } finally {
    // Always cleanup temp file if it was created
    if (tmpFileCreated) {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  }
}

// Calculate color saturation (0-1)
function getColorSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

// Calculate color brightness (0-255)
function getColorBrightness(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// Score a color for being a "primary" color (high saturation, medium-high brightness)
function getPrimaryColorScore(r: number, g: number, b: number): number {
  const saturation = getColorSaturation(r, g, b);
  const brightness = getColorBrightness(r, g, b);
  // Prefer colors with high saturation and medium-high brightness
  const brightnessScore = brightness > 50 && brightness < 220 ? 1 : 0.5;
  return saturation * brightnessScore * 100;
}

// Extract colors using vertical slice analysis - finds primary, secondary, tertiary colors
export async function extractColorsVerticalSlice(imageBuffer: Buffer): Promise<string[]> {
  try {
    // Resize image for processing
    const resizedBuffer = await sharp(imageBuffer)
      .resize(150, 200, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { data, info } = resizedBuffer;
    const { width, height, channels } = info;
    
    // Divide image into 5 vertical slices
    const sliceWidth = Math.floor(width / 5);
    const sliceColors: Map<string, { count: number; r: number; g: number; b: number; score: number }>[] = [];
    
    for (let slice = 0; slice < 5; slice++) {
      const colorMap = new Map<string, { count: number; r: number; g: number; b: number; score: number }>();
      const startX = slice * sliceWidth;
      const endX = slice === 4 ? width : (slice + 1) * sliceWidth;
      
      for (let y = 0; y < height; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * channels;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Skip near-white and near-black
          if (isNearWhite(r, g, b) || isNearBlack(r, g, b)) continue;
          
          // Quantize to reduce unique colors (group similar colors)
          const qr = Math.round(r / 32) * 32;
          const qg = Math.round(g / 32) * 32;
          const qb = Math.round(b / 32) * 32;
          const key = `${qr},${qg},${qb}`;
          
          const existing = colorMap.get(key);
          const score = getPrimaryColorScore(r, g, b);
          
          if (existing) {
            existing.count++;
            // Keep running average of actual colors
            existing.r = Math.round((existing.r * (existing.count - 1) + r) / existing.count);
            existing.g = Math.round((existing.g * (existing.count - 1) + g) / existing.count);
            existing.b = Math.round((existing.b * (existing.count - 1) + b) / existing.count);
            existing.score = Math.max(existing.score, score);
          } else {
            colorMap.set(key, { count: 1, r, g, b, score });
          }
        }
      }
      sliceColors.push(colorMap);
    }
    
    // Combine colors from all slices
    const combinedColors = new Map<string, { count: number; r: number; g: number; b: number; score: number; sliceCount: number }>();
    
    for (const sliceMap of sliceColors) {
      for (const [key, value] of sliceMap) {
        const existing = combinedColors.get(key);
        if (existing) {
          existing.count += value.count;
          existing.sliceCount++;
          existing.score = Math.max(existing.score, value.score);
        } else {
          combinedColors.set(key, { ...value, sliceCount: 1 });
        }
      }
    }
    
    // Convert to array and score colors
    const colorArray = Array.from(combinedColors.values()).map(c => ({
      ...c,
      // Final score: combination of count, color quality, and spread across slices
      finalScore: c.count * (1 + c.score / 100) * (1 + c.sliceCount / 5)
    }));
    
    // Sort by final score
    colorArray.sort((a, b) => b.finalScore - a.finalScore);
    
    // Select primary, secondary, tertiary with color diversity
    const selectedColors: string[] = [];
    const selectedRgb: [number, number, number][] = [];
    
    for (const color of colorArray) {
      if (selectedColors.length >= 4) break;
      
      // Ensure color is different enough from already selected colors
      const isDifferent = selectedRgb.every(
        existing => colorDistance(existing, [color.r, color.g, color.b]) > 60
      );
      
      if (isDifferent) {
        selectedColors.push(rgbToHex(color.r, color.g, color.b));
        selectedRgb.push([color.r, color.g, color.b]);
      }
    }
    
    return selectedColors;
  } catch (error) {
    console.error("Error extracting colors with vertical slice method:", error);
    return [];
  }
}

// Area-weighted extraction - focuses on large contiguous color regions, filters out text
export async function extractColorsAreaWeighted(imageBuffer: Buffer): Promise<string[]> {
  try {
    // Resize image for processing - use a larger size to better detect contiguous regions
    const resizedBuffer = await sharp(imageBuffer)
      .resize(100, 150, { fit: 'fill' })
      .blur(1.5) // Slight blur to merge text into background and reduce noise
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { data, info } = resizedBuffer;
    const { width, height, channels } = info;
    
    // Build a grid to track color regions
    // Quantize colors more aggressively to group similar shades
    const colorCounts = new Map<string, { 
      count: number; 
      r: number; 
      g: number; 
      b: number;
      positions: Set<number>; // Track pixel positions for contiguity
    }>();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Skip pure white and pure black
        if (isNearWhite(r, g, b) || isNearBlack(r, g, b)) continue;
        
        // Quantize more aggressively (48 levels instead of 32)
        const qr = Math.round(r / 48) * 48;
        const qg = Math.round(g / 48) * 48;
        const qb = Math.round(b / 48) * 48;
        const key = `${qr},${qg},${qb}`;
        
        const pixelPos = y * width + x;
        const existing = colorCounts.get(key);
        
        if (existing) {
          existing.count++;
          existing.positions.add(pixelPos);
          // Running average
          existing.r = Math.round((existing.r * (existing.count - 1) + r) / existing.count);
          existing.g = Math.round((existing.g * (existing.count - 1) + g) / existing.count);
          existing.b = Math.round((existing.b * (existing.count - 1) + b) / existing.count);
        } else {
          const positions = new Set<number>();
          positions.add(pixelPos);
          colorCounts.set(key, { count: 1, r, g, b, positions });
        }
      }
    }
    
    // Calculate contiguity score for each color
    // Colors that appear in scattered pixels (like text) will have low contiguity
    const colorScores = Array.from(colorCounts.entries()).map(([key, value]) => {
      // Calculate how "clumped" the pixels are
      const positions = Array.from(value.positions);
      let adjacentPairs = 0;
      
      for (const pos of positions) {
        const x = pos % width;
        const y = Math.floor(pos / width);
        
        // Check 4-neighbors
        const neighbors = [
          pos - 1, // left
          pos + 1, // right
          pos - width, // up
          pos + width, // down
        ];
        
        for (const neighbor of neighbors) {
          if (value.positions.has(neighbor)) {
            adjacentPairs++;
          }
        }
      }
      
      // Contiguity score: ratio of adjacent pairs to total pixels
      const contiguityScore = positions.length > 1 
        ? adjacentPairs / (positions.length * 2) 
        : 0;
      
      // Penalize very high saturation (likely text/titles)
      const saturation = getColorSaturation(value.r, value.g, value.b);
      const brightness = getColorBrightness(value.r, value.g, value.b);
      
      // Penalty for overly saturated bright colors (text-like)
      let saturationPenalty = 1;
      if (saturation > 0.8 && brightness > 150) {
        saturationPenalty = 0.3; // Heavy penalty for bright, saturated colors
      } else if (saturation > 0.7 && brightness > 180) {
        saturationPenalty = 0.5;
      }
      
      // Final score emphasizes:
      // 1. Raw pixel count (area)
      // 2. Contiguity (not scattered)
      // 3. Not overly saturated (penalize text)
      const finalScore = value.count * (0.5 + contiguityScore) * saturationPenalty;
      
      return {
        key,
        r: value.r,
        g: value.g,
        b: value.b,
        count: value.count,
        contiguityScore,
        saturationPenalty,
        finalScore,
      };
    });
    
    // Sort by final score
    colorScores.sort((a, b) => b.finalScore - a.finalScore);
    
    // Select diverse colors
    const selectedColors: string[] = [];
    const selectedRgb: [number, number, number][] = [];
    
    for (const color of colorScores) {
      if (selectedColors.length >= 4) break;
      
      // Ensure minimum difference from already selected colors
      const isDifferent = selectedRgb.every(
        existing => colorDistance(existing, [color.r, color.g, color.b]) > 50
      );
      
      if (isDifferent) {
        selectedColors.push(rgbToHex(color.r, color.g, color.b));
        selectedRgb.push([color.r, color.g, color.b]);
      }
    }
    
    return selectedColors;
  } catch (error) {
    console.error("Error extracting colors with area-weighted method:", error);
    return [];
  }
}

// ============================================================================
// PERCEPTUAL COLOR EXTRACTION WITH MEAN-SHIFT CLUSTERING
// This method uses LAB color space, filters outliers, and preserves accent colors
// ============================================================================

interface PixelData {
  r: number;
  g: number;
  b: number;
  lab: LABColor;
  x: number;
  y: number;
}

interface ColorCluster {
  centroid: LABColor;
  pixels: PixelData[];
  weight: number; // percentage of total pixels
  avgChroma: number;
  avgLightness: number;
  contiguityScore: number;
  isAccent: boolean;
}

// Check if a color is an outlier - ONLY pure white/black extremes
// Most colors should pass through and let clustering handle them
function isOutlierColor(r: number, g: number, b: number): boolean {
  // Only filter PURE white (255,255,255 or very close)
  if (r > 252 && g > 252 && b > 252) return true;
  
  // Only filter PURE black (0,0,0 or very close)
  if (r < 3 && g < 3 && b < 3) return true;
  
  return false;
}

// Check if a color might be an accent (bright and saturated but not white/yellow text)
function isAccentCandidate(lab: LABColor): boolean {
  const chroma = getLabChroma(lab);
  
  // Accents are colorful (high chroma) but not too light
  return chroma > 40 && lab.L > 30 && lab.L < 85;
}

// Mean-Shift kernel - Gaussian weighted by distance
function meanShiftKernel(distance: number, bandwidth: number): number {
  if (distance > bandwidth) return 0;
  const ratio = distance / bandwidth;
  return Math.exp(-0.5 * ratio * ratio);
}

// Perform Mean-Shift step for a single point
function meanShiftStep(point: LABColor, allPoints: LABColor[], bandwidth: number): LABColor {
  let sumL = 0, sumA = 0, sumB = 0;
  let totalWeight = 0;
  
  for (const p of allPoints) {
    const dist = deltaE(point, p);
    const weight = meanShiftKernel(dist, bandwidth);
    
    if (weight > 0) {
      sumL += p.L * weight;
      sumA += p.a * weight;
      sumB += p.b * weight;
      totalWeight += weight;
    }
  }
  
  if (totalWeight === 0) return point;
  
  return {
    L: sumL / totalWeight,
    a: sumA / totalWeight,
    b: sumB / totalWeight
  };
}

// Calculate contiguity score for a set of pixels
function calculateContiguity(pixels: PixelData[], width: number): number {
  if (pixels.length < 2) return 0;
  
  const positionSet = new Set(pixels.map(p => p.y * width + p.x));
  let adjacentCount = 0;
  
  for (const p of pixels) {
    const pos = p.y * width + p.x;
    // Check 4 neighbors
    if (positionSet.has(pos - 1)) adjacentCount++;
    if (positionSet.has(pos + 1)) adjacentCount++;
    if (positionSet.has(pos - width)) adjacentCount++;
    if (positionSet.has(pos + width)) adjacentCount++;
  }
  
  // Normalize: ratio of adjacent pairs to possible pairs
  return adjacentCount / (pixels.length * 4);
}

// Main perceptual extraction function
export async function extractColorsPerceptual(imageBuffer: Buffer): Promise<string[]> {
  try {
    // Step 1: Resize and get raw pixel data
    const resizedBuffer = await sharp(imageBuffer)
      .resize(80, 120, { fit: 'fill' }) // Smaller for faster clustering
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { data, info } = resizedBuffer;
    const { width, height, channels } = info;
    const totalPixels = width * height;
    
    // Step 2: Extract pixels and convert to LAB, filtering outliers
    const pixels: PixelData[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Skip outlier colors (pure white, pure black, extreme brightness)
        if (isOutlierColor(r, g, b)) continue;
        
        const lab = rgbToLab(r, g, b);
        pixels.push({ r, g, b, lab, x, y });
      }
    }
    
    if (pixels.length < 10) {
      console.log('[Perceptual] Not enough valid pixels after filtering');
      return [];
    }
    
    // Step 3: Quantize colors for faster Mean-Shift (reduce to ~200 representative colors)
    const colorBuckets = new Map<string, { lab: LABColor; count: number; pixels: PixelData[] }>();
    
    for (const p of pixels) {
      // Quantize LAB values
      const qL = Math.round(p.lab.L / 10) * 10;
      const qA = Math.round(p.lab.a / 15) * 15;
      const qB = Math.round(p.lab.b / 15) * 15;
      const key = `${qL},${qA},${qB}`;
      
      const existing = colorBuckets.get(key);
      if (existing) {
        existing.count++;
        existing.pixels.push(p);
        // Update centroid as running average
        existing.lab.L = (existing.lab.L * (existing.count - 1) + p.lab.L) / existing.count;
        existing.lab.a = (existing.lab.a * (existing.count - 1) + p.lab.a) / existing.count;
        existing.lab.b = (existing.lab.b * (existing.count - 1) + p.lab.b) / existing.count;
      } else {
        colorBuckets.set(key, { lab: { ...p.lab }, count: 1, pixels: [p] });
      }
    }
    
    // Step 4: Filter by minimum weight threshold (remove colors < 1% of FILTERED pixels)
    // Use pixels.length (post-filter) so that filtered-out colors don't skew the threshold
    const minThreshold = pixels.length * 0.01;
    const significantBuckets = Array.from(colorBuckets.values())
      .filter(b => b.count >= minThreshold || isAccentCandidate(b.lab));
    
    if (significantBuckets.length === 0) {
      // Fallback: use all buckets if too strict
      significantBuckets.push(...Array.from(colorBuckets.values()));
    }
    
    // Step 5: Mean-Shift clustering
    const bandwidth = 25; // Delta E threshold for clustering
    const maxIterations = 10;
    const convergenceThreshold = 1;
    
    const clusterCentroids: LABColor[] = [];
    const allLabPoints = significantBuckets.map(b => b.lab);
    
    // Initialize with bucket centroids
    for (const bucket of significantBuckets) {
      let current = { ...bucket.lab };
      
      // Iterate Mean-Shift until convergence
      for (let iter = 0; iter < maxIterations; iter++) {
        const next = meanShiftStep(current, allLabPoints, bandwidth);
        const shift = deltaE(current, next);
        current = next;
        
        if (shift < convergenceThreshold) break;
      }
      
      // Check if this converged to an existing centroid
      let merged = false;
      for (const existing of clusterCentroids) {
        if (deltaE(current, existing) < bandwidth / 2) {
          merged = true;
          break;
        }
      }
      
      if (!merged) {
        clusterCentroids.push(current);
      }
    }
    
    // Step 6: Assign pixels to nearest cluster and compute metrics
    const clusters: ColorCluster[] = clusterCentroids.map(c => ({
      centroid: c,
      pixels: [],
      weight: 0,
      avgChroma: getLabChroma(c),
      avgLightness: c.L,
      contiguityScore: 0,
      isAccent: false
    }));
    
    for (const bucket of significantBuckets) {
      let minDist = Infinity;
      let nearestCluster = clusters[0];
      
      for (const cluster of clusters) {
        const dist = deltaE(bucket.lab, cluster.centroid);
        if (dist < minDist) {
          minDist = dist;
          nearestCluster = cluster;
        }
      }
      
      nearestCluster.pixels.push(...bucket.pixels);
    }
    
    // Calculate weights and contiguity for each cluster
    for (const cluster of clusters) {
      cluster.weight = cluster.pixels.length / pixels.length;
      cluster.contiguityScore = calculateContiguity(cluster.pixels, width);
      
      // Identify accent colors: high chroma, reasonable contiguity, not tiny
      const chroma = getLabChroma(cluster.centroid);
      if (chroma > 45 && cluster.weight > 0.02 && cluster.weight < 0.15 && cluster.contiguityScore > 0.1) {
        cluster.isAccent = true;
      }
    }
    
    // Step 7: Select final palette
    // Score clusters: weight heavily, boost accents, PENALIZE very dark colors
    const scoredClusters = clusters
      .filter(c => c.weight > 0.005) // At least 0.5% of pixels
      .map(c => {
        // Penalize very dark colors (L < 15) - they make gradients too dark
        // Also slightly penalize very light colors (L > 90) for balance
        let lightnessPenalty = 1;
        if (c.centroid.L < 15) {
          lightnessPenalty = 0.3; // Heavy penalty for near-black
        } else if (c.centroid.L < 25) {
          lightnessPenalty = 0.6; // Moderate penalty for very dark
        } else if (c.centroid.L > 95) {
          lightnessPenalty = 0.8; // Slight penalty for near-white
        }
        
        return {
          cluster: c,
          score: c.weight * (1 + c.contiguityScore) * (c.isAccent ? 2.5 : 1) * lightnessPenalty
        };
      })
      .sort((a, b) => b.score - a.score);
    
    // Select top clusters with diversity in both hue AND lightness
    const selectedClusters: ColorCluster[] = [];
    const minDeltaE = 15; // Minimum perceptual difference between selected colors
    
    for (const { cluster } of scoredClusters) {
      if (selectedClusters.length >= 4) break;
      
      // Ensure perceptual diversity
      const isDifferent = selectedClusters.every(
        existing => deltaE(existing.centroid, cluster.centroid) > minDeltaE
      );
      
      // Also ensure lightness diversity - don't pick too many dark or light colors
      const darkCount = selectedClusters.filter(c => c.centroid.L < 30).length;
      const lightCount = selectedClusters.filter(c => c.centroid.L > 70).length;
      const isTooManyDark = cluster.centroid.L < 30 && darkCount >= 1;
      const isTooManyLight = cluster.centroid.L > 70 && lightCount >= 2;
      
      if (isDifferent && !isTooManyDark && !isTooManyLight) {
        selectedClusters.push(cluster);
      }
    }
    
    // If we don't have enough colors, relax the constraints
    if (selectedClusters.length < 3) {
      for (const { cluster } of scoredClusters) {
        if (selectedClusters.length >= 4) break;
        if (selectedClusters.includes(cluster)) continue;
        
        const isDifferent = selectedClusters.every(
          existing => deltaE(existing.centroid, cluster.centroid) > 10
        );
        if (isDifferent) {
          selectedClusters.push(cluster);
        }
      }
    }
    
    // Ensure at least one accent color if available
    if (selectedClusters.length < 4) {
      const accentCluster = scoredClusters.find(
        sc => sc.cluster.isAccent && !selectedClusters.includes(sc.cluster)
      );
      if (accentCluster) {
        selectedClusters.push(accentCluster.cluster);
      }
    }
    
    // Step 8: Sort by WEIGHT (pixel coverage) - most dominant color first
    // This ensures the color covering the most area is used as the primary/base color
    selectedClusters.sort((a, b) => b.weight - a.weight);
    
    // Convert back to RGB hex
    const palette = selectedClusters.map(cluster => {
      const [r, g, b] = labToRgb(cluster.centroid.L, cluster.centroid.a, cluster.centroid.b);
      return rgbToHex(r, g, b);
    });
    
    console.log(`[Perceptual] Extracted ${palette.length} colors:`, palette);
    
    return palette;
  } catch (error) {
    console.error("Error extracting colors with perceptual method:", error);
    return [];
  }
}

// Main extraction function that uses the configured method
export async function extractDominantColorsWithMethod(
  imageBuffer: Buffer, 
  method: 'mmcq' | 'vertical-slice' | 'area-weighted' | 'perceptual' = 'mmcq'
): Promise<string[]> {
  if (method === 'vertical-slice') {
    return extractColorsVerticalSlice(imageBuffer);
  }
  if (method === 'area-weighted') {
    return extractColorsAreaWeighted(imageBuffer);
  }
  if (method === 'perceptual') {
    return extractColorsPerceptual(imageBuffer);
  }
  return extractDominantColors(imageBuffer);
}

export async function extractMetadata(
  file: File,
  filename: string
): Promise<ExtractedMetadata> {
  const ext = path.extname(filename).toLowerCase();

  // Download file to buffer
  const [buffer] = await file.download();

  switch (ext) {
    case ".epub":
      return extractEpubMetadata(buffer, filename);
    case ".pdf":
      return extractPdfMetadata(buffer);
    case ".m4b":
    case ".mp3":
    case ".m4a":
      return extractAudioMetadata(buffer, filename);
    default:
      // For unsupported formats, return basic info
      return {
        title: path.basename(filename, ext),
      };
  }
}

export async function extractMetadataFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<ExtractedMetadata> {
  const ext = path.extname(filename).toLowerCase();

  let metadata: ExtractedMetadata;
  
  switch (ext) {
    case ".epub":
      metadata = await extractEpubMetadata(buffer, filename);
      break;
    case ".pdf":
      metadata = await extractPdfMetadata(buffer);
      break;
    case ".m4b":
    case ".mp3":
    case ".m4a":
      metadata = await extractAudioMetadata(buffer, filename);
      break;
    default:
      metadata = {
        title: path.basename(filename, ext),
      };
  }

  // Extract dominant colors if cover image is available
  if (metadata.coverImageData) {
    try {
      metadata.dominantColors = await extractDominantColors(metadata.coverImageData);
    } catch (error) {
      console.error("Error extracting colors:", error);
    }
  }

  return metadata;
}

async function extractEpubMetadata(
  buffer: Buffer,
  filename: string
): Promise<ExtractedMetadata> {
  return new Promise((resolve, reject) => {
    const tmpPath = `/tmp/${Date.now()}-${filename}`;
    fs.writeFileSync(tmpPath, buffer);

    const epub = new EPub(tmpPath);
    
    epub.on("end", async () => {
      const epubMeta = epub.metadata as any;
      
      const metadata: ExtractedMetadata = {
        title: epubMeta.title || path.basename(filename, ".epub"),
        author: epubMeta.creator,
        description: epubMeta.description,
        language: epubMeta.language,
        publisher: epubMeta.publisher,
      };

      // Extract ISBN - check various possible locations in EPUB metadata
      // EPUB files can store ISBN in different fields: ISBN, identifier, or dc:identifier
      let isbn: string | undefined;
      
      // Check direct ISBN field
      if (epubMeta.ISBN) {
        isbn = epubMeta.ISBN;
      } else if (epubMeta.isbn) {
        isbn = epubMeta.isbn;
      }
      
      // Check identifier field (common location for ISBN)
      if (!isbn && epubMeta.identifier) {
        const identifier = epubMeta.identifier;
        if (typeof identifier === 'string') {
          // Check if it looks like an ISBN (10 or 13 digits, possibly with hyphens)
          const isbnMatch = identifier.match(/(?:ISBN[:\s-]*)?(\d{10}|\d{13}|\d{3}-\d{1,5}-\d{1,7}-\d{1,7}-\d{1})/i);
          if (isbnMatch) {
            isbn = isbnMatch[1] || isbnMatch[0];
          }
        }
      }
      
      // Check identifiers array if present (some EPUB parsers provide this)
      if (!isbn && Array.isArray(epubMeta.identifiers)) {
        for (const id of epubMeta.identifiers) {
          if (id && typeof id === 'object') {
            if (id.scheme?.toLowerCase() === 'isbn' || id.type?.toLowerCase() === 'isbn') {
              isbn = id.value || id.id;
              break;
            }
          } else if (typeof id === 'string') {
            const isbnMatch = id.match(/(?:ISBN[:\s-]*)?(\d{10}|\d{13}|\d{3}-\d{1,5}-\d{1,7}-\d{1,7}-\d{1})/i);
            if (isbnMatch) {
              isbn = isbnMatch[1] || isbnMatch[0];
              break;
            }
          }
        }
      }
      
      // Clean up ISBN - remove hyphens and spaces
      if (isbn) {
        metadata.isbn = isbn.replace(/[-\s]/g, '');
        console.log(`[EPUB Metadata] Found ISBN: ${metadata.isbn}`);
      }

      // Try to extract cover image
      try {
        const cover = epubMeta.cover;
        if (cover) {
          const [, coverData] = await new Promise<[any, Buffer]>((res, rej) => {
            epub.getImage(cover, (err, data, mimeType) => {
              if (err) rej(err);
              else res([mimeType, data]);
            });
          });
          metadata.coverImageData = coverData;
        }
      } catch (err) {
        console.error("Error extracting cover from EPUB:", err);
      }

      // Clean up temp file
      fs.unlinkSync(tmpPath);
      resolve(metadata);
    });

    epub.on("error", (err) => {
      // Clean up temp file
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
      reject(err);
    });

    epub.parse();
  });
}

async function extractPdfMetadata(buffer: Buffer): Promise<ExtractedMetadata> {
  const data = await pdfParse(buffer);
  
  const metadata: ExtractedMetadata = {
    title: data.info?.Title,
    author: data.info?.Author,
    pageCount: data.numpages,
  };

  return metadata;
}

async function extractAudioMetadata(
  buffer: Buffer,
  filename: string
): Promise<ExtractedMetadata> {
  const tmpPath = `/tmp/${Date.now()}-${filename}`;
  fs.writeFileSync(tmpPath, buffer);

  try {
    const audioMetadata = await parseFile(tmpPath);
    
    const metadata: ExtractedMetadata = {
      title: audioMetadata.common.title || path.basename(filename, path.extname(filename)),
      author: audioMetadata.common.artist || audioMetadata.common.albumartist,
      narrator: Array.isArray(audioMetadata.common.composer) 
        ? audioMetadata.common.composer[0] 
        : audioMetadata.common.composer,
      publisher: Array.isArray(audioMetadata.common.label) 
        ? audioMetadata.common.label[0] 
        : audioMetadata.common.label,
      publishedYear: audioMetadata.common.year,
      duration: audioMetadata.format.duration,
      description: audioMetadata.common.comment 
        ? (typeof audioMetadata.common.comment === 'string' 
          ? audioMetadata.common.comment 
          : (audioMetadata.common.comment as any).text || String(audioMetadata.common.comment))
        : undefined,
      isbn: Array.isArray(audioMetadata.common.isrc) 
        ? audioMetadata.common.isrc[0] 
        : audioMetadata.common.isrc,
      language: audioMetadata.common.language,
      series: audioMetadata.common.album,
    };

    // Extract cover art
    if (audioMetadata.common.picture && audioMetadata.common.picture.length > 0) {
      metadata.coverImageData = Buffer.from(audioMetadata.common.picture[0].data);
    }

    // Extract chapters from M4B files (and other formats that support chapters)
    // The native metadata can contain chapter information in different formats
    const nativeMetadata = audioMetadata.native;
    const chapters: AudioChapter[] = [];
    
    // Check for iTunes-style chapters (common in M4B)
    if (nativeMetadata) {
      // Try to find chapter markers in various native formats
      for (const format of Object.keys(nativeMetadata)) {
        const tags = nativeMetadata[format as keyof typeof nativeMetadata];
        if (Array.isArray(tags)) {
          for (const tag of tags) {
            // Look for chapter title tags with time information
            if (tag.id === 'CHAP' || tag.id === 'CTOC' || tag.id === 'TIT2') {
              // ID3v2 chapter tags
              if (tag.value && typeof tag.value === 'object' && 'startTime' in tag.value) {
                const chapterData = tag.value as { startTime: number; endTime?: number; tags?: any };
                const title = chapterData.tags?.title || chapterData.tags?.TIT2 || `Chapter ${chapters.length + 1}`;
                chapters.push({
                  title: typeof title === 'string' ? title : String(title),
                  startTime: chapterData.startTime / 1000, // Convert ms to seconds
                  endTime: chapterData.endTime ? chapterData.endTime / 1000 : undefined,
                });
              }
            }
          }
        }
      }
    }
    
    // If no chapters found in native metadata, check for chapter property
    // music-metadata may expose chapters in common.chapter
    const commonAny = audioMetadata.common as any;
    if (chapters.length === 0 && commonAny.chapter && Array.isArray(commonAny.chapter)) {
      for (const chap of commonAny.chapter) {
        if (chap && typeof chap === 'object') {
          chapters.push({
            title: chap.title || `Chapter ${chapters.length + 1}`,
            startTime: typeof chap.startTime === 'number' ? chap.startTime : 0,
            endTime: typeof chap.endTime === 'number' ? chap.endTime : undefined,
          });
        }
      }
    }
    
    if (chapters.length > 0) {
      metadata.chapters = chapters;
    }

    // Clean up temp file
    fs.unlinkSync(tmpPath);
    return metadata;
  } catch (err) {
    // Clean up temp file
    try {
      fs.unlinkSync(tmpPath);
    } catch {}
    throw err;
  }
}

// ============================================================================
// OPEN LIBRARY ISBN LOOKUP & METADATA ENRICHMENT
// Uses the free Open Library API to find ISBNs and enrich book metadata
// ============================================================================

interface OpenLibrarySearchResult {
  numFound: number;
  docs: Array<{
    title?: string;
    author_name?: string[];
    isbn?: string[];
    first_publish_year?: number;
    key?: string;
    subject?: string[];
    publisher?: string[];
    number_of_pages?: number;
  }>;
}

interface OpenLibraryBookData {
  title?: string;
  authors?: Array<{ key: string }>;
  subjects?: Array<{ name: string } | string>;
  subject_places?: Array<{ name: string } | string>;
  subject_times?: Array<{ name: string } | string>;
  description?: string | { value: string };
  first_publish_date?: string;
  publish_date?: string;
  publishers?: string[];
  number_of_pages?: number;
  covers?: number[];
}

export interface EnrichedMetadata {
  title?: string;
  author?: string;
  description?: string;
  subjects?: string[];
  publishedDate?: string;
  publisher?: string;
  pageCount?: number;
  coverUrl?: string;
}

/**
 * Enrich book metadata using ISBN via Open Library API
 * Fetches tags/subjects, publication date, description, page count, etc.
 * This is a free API that doesn't require authentication
 */
export async function enrichMetadataByIsbn(isbn: string): Promise<EnrichedMetadata | null> {
  try {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    console.log(`[OpenLibrary] Enriching metadata for ISBN: ${cleanIsbn}`);

    // First try the ISBN API for edition-specific data
    const isbnUrl = `https://openlibrary.org/isbn/${cleanIsbn}.json`;
    const isbnResponse = await fetch(isbnUrl, {
      headers: {
        'User-Agent': 'Luma-EReader/1.0',
      },
    });

    if (!isbnResponse.ok) {
      console.log(`[OpenLibrary] ISBN lookup failed, trying search...`);
      return enrichMetadataByIsbnSearch(cleanIsbn);
    }

    const isbnData: OpenLibraryBookData = await isbnResponse.json();
    const enriched: EnrichedMetadata = {};

    // Get title
    if (isbnData.title) {
      enriched.title = isbnData.title;
    }

    // Get description
    if (isbnData.description) {
      enriched.description = typeof isbnData.description === 'string' 
        ? isbnData.description 
        : isbnData.description.value;
    }

    // Get page count
    if (isbnData.number_of_pages) {
      enriched.pageCount = isbnData.number_of_pages;
    }

    // Get publishers
    if (isbnData.publishers && isbnData.publishers.length > 0) {
      enriched.publisher = isbnData.publishers[0];
    }

    // Get publish date
    if (isbnData.publish_date) {
      enriched.publishedDate = isbnData.publish_date;
    } else if (isbnData.first_publish_date) {
      enriched.publishedDate = isbnData.first_publish_date;
    }

    // Get subjects - combine all subject types
    const allSubjects: string[] = [];
    
    const extractSubjects = (arr: Array<{ name: string } | string> | undefined) => {
      if (!arr) return;
      for (const item of arr) {
        const name = typeof item === 'string' ? item : item.name;
        if (name && !allSubjects.includes(name)) {
          allSubjects.push(name);
        }
      }
    };

    extractSubjects(isbnData.subjects);
    extractSubjects(isbnData.subject_places);
    extractSubjects(isbnData.subject_times);

    // If no subjects from edition, try to get from the work
    if (allSubjects.length === 0 && isbnData.authors) {
      // The ISBN data might have a works key we can follow
      try {
        const worksUrl = `https://openlibrary.org/isbn/${cleanIsbn}/works.json`;
        const worksResponse = await fetch(worksUrl, {
          headers: { 'User-Agent': 'Luma-EReader/1.0' },
        });
        
        if (worksResponse.ok) {
          const worksData = await worksResponse.json();
          if (worksData.entries && worksData.entries.length > 0) {
            const work = worksData.entries[0];
            extractSubjects(work.subjects);
            
            // Also try to get description from work if not in edition
            if (!enriched.description && work.description) {
              enriched.description = typeof work.description === 'string'
                ? work.description
                : work.description.value;
            }
          }
        }
      } catch (err) {
        // Ignore work lookup errors
      }
    }

    if (allSubjects.length > 0) {
      // Limit to 10 most relevant subjects and clean them up
      enriched.subjects = allSubjects
        .filter(s => s.length < 50) // Skip very long subject strings
        .slice(0, 10);
    }

    // Get cover URL if available
    if (isbnData.covers && isbnData.covers.length > 0) {
      enriched.coverUrl = `https://covers.openlibrary.org/b/id/${isbnData.covers[0]}-L.jpg`;
    }

    console.log(`[OpenLibrary] Enriched metadata:`, {
      hasDescription: !!enriched.description,
      subjectsCount: enriched.subjects?.length || 0,
      hasPublishDate: !!enriched.publishedDate,
      hasPublisher: !!enriched.publisher,
    });

    return enriched;
  } catch (error) {
    console.error('[OpenLibrary] Error enriching metadata:', error);
    return null;
  }
}

/**
 * Fallback: search for ISBN to get metadata
 */
async function enrichMetadataByIsbnSearch(isbn: string): Promise<EnrichedMetadata | null> {
  try {
    const searchUrl = `https://openlibrary.org/search.json?isbn=${isbn}&fields=key,title,author_name,subject,publisher,first_publish_year,number_of_pages_median&limit=1`;
    
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Luma-EReader/1.0' },
    });

    if (!response.ok) {
      return null;
    }

    const data: OpenLibrarySearchResult = await response.json();
    
    if (data.numFound === 0 || !data.docs || data.docs.length === 0) {
      return null;
    }

    const doc = data.docs[0];
    const enriched: EnrichedMetadata = {};

    if (doc.title) enriched.title = doc.title;
    if (doc.author_name && doc.author_name.length > 0) {
      enriched.author = doc.author_name.join(', ');
    }
    if (doc.first_publish_year) {
      enriched.publishedDate = String(doc.first_publish_year);
    }
    if (doc.publisher && doc.publisher.length > 0) {
      enriched.publisher = doc.publisher[0];
    }
    if (doc.subject && doc.subject.length > 0) {
      enriched.subjects = doc.subject
        .filter(s => s.length < 50)
        .slice(0, 10);
    }

    return enriched;
  } catch (error) {
    console.error('[OpenLibrary] Search fallback error:', error);
    return null;
  }
}

/**
 * Look up ISBN from Open Library by title and author
 * This is a free API that doesn't require authentication
 * Returns the first ISBN found, preferring ISBN-13 over ISBN-10
 */
export async function lookupIsbnFromOpenLibrary(
  title: string,
  author?: string
): Promise<string | null> {
  try {
    // Build the search URL with title and optional author
    const params = new URLSearchParams({
      title: title,
      fields: 'key,title,author_name,isbn,first_publish_year',
      limit: '5',
    });
    
    if (author) {
      params.set('author', author);
    }
    
    const url = `https://openlibrary.org/search.json?${params.toString()}`;
    console.log(`[OpenLibrary] Looking up ISBN for: "${title}" by ${author || 'unknown'}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Luma-EReader/1.0 (https://github.com/your-repo)',
      },
    });
    
    if (!response.ok) {
      console.warn(`[OpenLibrary] API returned status ${response.status}`);
      return null;
    }
    
    const data: OpenLibrarySearchResult = await response.json();
    
    if (data.numFound === 0 || !data.docs || data.docs.length === 0) {
      console.log(`[OpenLibrary] No results found for "${title}"`);
      return null;
    }
    
    // Look through results to find one with ISBNs
    for (const doc of data.docs) {
      if (doc.isbn && doc.isbn.length > 0) {
        // Prefer ISBN-13 (starts with 978 or 979 and is 13 digits)
        const isbn13 = doc.isbn.find(
          (isbn) => /^(978|979)\d{10}$/.test(isbn.replace(/-/g, ''))
        );
        
        if (isbn13) {
          console.log(`[OpenLibrary] Found ISBN-13: ${isbn13} for "${title}"`);
          return isbn13.replace(/-/g, '');
        }
        
        // Fall back to ISBN-10 (10 digits, may end with X)
        const isbn10 = doc.isbn.find(
          (isbn) => /^\d{9}[\dXx]$/.test(isbn.replace(/-/g, ''))
        );
        
        if (isbn10) {
          console.log(`[OpenLibrary] Found ISBN-10: ${isbn10} for "${title}"`);
          return isbn10.replace(/-/g, '');
        }
        
        // Return any ISBN if neither 13 nor 10 format found
        const cleanIsbn = doc.isbn[0].replace(/-/g, '');
        console.log(`[OpenLibrary] Found ISBN: ${cleanIsbn} for "${title}"`);
        return cleanIsbn;
      }
    }
    
    console.log(`[OpenLibrary] Results found but no ISBNs for "${title}"`);
    return null;
  } catch (error) {
    console.error('[OpenLibrary] Error looking up ISBN:', error);
    return null;
  }
}
