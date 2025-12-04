import fs from 'fs';
import path from 'path';

// Configuration directory - same as database location
const configDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const configFile = path.join(configDir, 'settings.json');
const secretsFile = path.join(configDir, '.secrets.json');

// Ensure config directory exists
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

export type GradientStyle = 'radial' | 'linear' | 'inverted-radial' | 'horizontal' | 'vertical' | 'multi-point';
export type ColorExtractionMethod = 'mmcq' | 'vertical-slice' | 'area-weighted' | 'perceptual';

export interface AppSettings {
  libraryPaths: string[];
  scanOnStartup: boolean;
  autoDownloadRecommendations: boolean;
  defaultReadingTheme: string;
  defaultAudiobookSpeed: number;
  sleepTimerDefault: number;
  enableCloudflareBypass: boolean;
  annasArchiveDonatorKey?: string;
  // Hero gradient settings
  heroGradientStyle: GradientStyle;
  heroColorExtractionMethod: ColorExtractionMethod;
  heroGradientPoints: number; // 3-10, number of radial gradient layers
}

export interface AppSecrets {
  sessionSecret?: string;
  googleBooksApiKey?: string;
  sendgridApiKey?: string;
  resendApiKey?: string;
  googleCloudProjectId?: string;
  googleCloudStorageBucket?: string;
  googleClientId?: string;
  googleClientSecret?: string;
}

const defaultSettings: AppSettings = {
  libraryPaths: [],
  scanOnStartup: false,
  autoDownloadRecommendations: false,
  defaultReadingTheme: 'sepia',
  defaultAudiobookSpeed: 1.0,
  sleepTimerDefault: 30,
  enableCloudflareBypass: true,
  heroGradientStyle: 'multi-point',
  heroColorExtractionMethod: 'mmcq',
  heroGradientPoints: 6,
};

const defaultSecrets: AppSecrets = {};

// Load settings from file
export function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(configFile)) {
      const data = fs.readFileSync(configFile, 'utf-8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return { ...defaultSettings };
}

// Save settings to file
export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const updated = { ...current, ...settings };
  
  try {
    fs.writeFileSync(configFile, JSON.stringify(updated, null, 2), 'utf-8');
    console.log(`Settings saved to: ${configFile}`);
  } catch (error) {
    console.error('Error saving settings:', error);
  }
  
  return updated;
}

// Load secrets from file (falls back to environment variables)
export function loadSecrets(): AppSecrets {
  const secrets: AppSecrets = { ...defaultSecrets };
  
  // First, try loading from secrets file
  try {
    if (fs.existsSync(secretsFile)) {
      const data = fs.readFileSync(secretsFile, 'utf-8');
      Object.assign(secrets, JSON.parse(data));
    }
  } catch (error) {
    console.error('Error loading secrets file:', error);
  }
  
  // Environment variables override file-based secrets
  if (process.env.SESSION_SECRET) secrets.sessionSecret = process.env.SESSION_SECRET;
  if (process.env.GOOGLE_BOOKS_API_KEY) secrets.googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (process.env.SENDGRID_API_KEY) secrets.sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (process.env.RESEND_API_KEY) secrets.resendApiKey = process.env.RESEND_API_KEY;
  if (process.env.GOOGLE_CLOUD_PROJECT_ID) secrets.googleCloudProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (process.env.GOOGLE_CLOUD_STORAGE_BUCKET) secrets.googleCloudStorageBucket = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (process.env.GOOGLE_CLIENT_ID) secrets.googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (process.env.GOOGLE_CLIENT_SECRET) secrets.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  return secrets;
}

// Save secrets to file (with restricted permissions)
export function saveSecrets(newSecrets: Partial<AppSecrets>): void {
  const current = loadSecrets();
  // Only save file-based secrets, not env var overrides
  const fileSecrets: AppSecrets = {};
  
  try {
    if (fs.existsSync(secretsFile)) {
      Object.assign(fileSecrets, JSON.parse(fs.readFileSync(secretsFile, 'utf-8')));
    }
  } catch (error) {
    // Ignore - file might not exist
  }
  
  const updated = { ...fileSecrets, ...newSecrets };
  
  try {
    fs.writeFileSync(secretsFile, JSON.stringify(updated, null, 2), { mode: 0o600 });
    console.log(`Secrets saved to: ${secretsFile}`);
  } catch (error) {
    console.error('Error saving secrets:', error);
  }
}

// Get a specific secret (checks file then env)
export function getSecret(key: keyof AppSecrets): string | undefined {
  const secrets = loadSecrets();
  return secrets[key];
}

// Check if secrets are configured
export function hasSecret(key: keyof AppSecrets): boolean {
  return !!getSecret(key);
}

// Get config file paths for logging
export function getConfigPaths() {
  return {
    configDir,
    configFile,
    secretsFile,
  };
}

console.log(`Configuration directory: ${configDir}`);
