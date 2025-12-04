/**
 * Cloudflare Bypass Manager
 * Handles intelligent bypass with HTTP-first approach and Playwright escalation
 */

import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';

interface BypassSession {
  cookies?: any[];
  userAgent?: string;
  lastUsed?: Date;
}

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  useBrowser?: boolean; // Force browser usage
}

interface FetchResult {
  html: string;
  status: number;
  cookies?: any[];
}

export class BypassManager {
  private browser: Browser | null = null;
  private session: BypassSession = {};
  private readonly maxRetries = 3;
  private readonly retryDelays = [0, 5000, 10000]; // ms delays between methods

  /**
   * Fetch a URL with intelligent Cloudflare bypass
   * Tries HTTP first, escalates to Playwright if Cloudflare detected
   */
  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const { method = 'GET', headers = {}, body, useBrowser = false } = options;

    // Try simple HTTP request first unless browser forced
    if (!useBrowser) {
      try {
        const result = await this.fetchWithHttp(url, method, headers, body);
        
        // Check if Cloudflare challenge page
        if (!this.isCloudflareChallenge(result.html)) {
          console.log(`[BypassManager] HTTP request successful for ${url}`);
          return result;
        }
        
        console.log(`[BypassManager] Cloudflare detected, escalating to browser bypass`);
      } catch (error) {
        console.error(`[BypassManager] HTTP request failed, trying browser:`, error);
      }
    }

    // Escalate to browser-based bypass with retries
    try {
      return await this.fetchWithBrowser(url, method, headers);
    } catch (error) {
      // If Playwright unavailable, throw clear error for UI handling
      if (error instanceof Error && error.message.includes('Playwright browser unavailable')) {
        console.warn('[BypassManager] Playwright unavailable - Cloudflare bypass not possible');
        throw new Error('Cloudflare protection detected. Please install Playwright dependencies with: npx playwright install --with-deps');
      }
      throw error;
    }
  }

  /**
   * Simple HTTP fetch with proper headers
   */
  private async fetchWithHttp(
    url: string,
    method: string,
    customHeaders: Record<string, string>,
    body?: string
  ): Promise<FetchResult> {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      ...customHeaders,
    };

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    const html = await response.text();

    return {
      html,
      status: response.status,
    };
  }

  /**
   * Browser-based bypass using Playwright with stealth
   */
  private async fetchWithBrowser(
    url: string,
    method: string,
    customHeaders: Record<string, string>
  ): Promise<FetchResult> {
    let lastError: Error | null = null;

    // Try 3 different bypass methods with increasing delays
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`[BypassManager] Bypass attempt ${attempt + 1}/${this.maxRetries}`);
        
        // Wait before retry (except first attempt)
        if (this.retryDelays[attempt] > 0) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelays[attempt]));
        }

        const result = await this.bypassMethod(url, attempt + 1);
        
        // Check if we successfully bypassed Cloudflare
        if (!this.isCloudflareChallenge(result.html)) {
          console.log(`[BypassManager] Bypass successful on attempt ${attempt + 1}`);
          return result;
        }

        console.log(`[BypassManager] Bypass method ${attempt + 1} failed, still see Cloudflare challenge`);
      } catch (error) {
        console.error(`[BypassManager] Bypass method ${attempt + 1} error:`, error);
        lastError = error as Error;
      }
    }

    throw new Error(`Cloudflare bypass failed after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Individual bypass method implementation
   */
  private async bypassMethod(url: string, methodNumber: number): Promise<FetchResult> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });

    const page = await context.newPage();

    try {
      // Navigate to page - use domcontentloaded instead of networkidle to avoid Cloudflare long-lived connections
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait a bit for any JavaScript to execute
      await page.waitForTimeout(2000 + (methodNumber * 1000));

      // Check for Cloudflare checkbox/button and click if present
      const cfButton = await page.$('input[type="checkbox"]');
      if (cfButton) {
        console.log(`[BypassManager] Found Cloudflare checkbox, clicking...`);
        await cfButton.click();
        await page.waitForTimeout(3000);
      }

      // Wait for Anna's Archive search results to render (or timeout if still on challenge page)
      try {
        await page.waitForSelector('a.js-vim-focus', { timeout: 45000 });
        console.log(`[BypassManager] Search results loaded successfully`);
      } catch (selectorError) {
        console.warn(`[BypassManager] Search results selector timeout - may still be on Cloudflare page`);
      }

      // Get final HTML
      const html = await page.content();
      const cookies = await context.cookies();

      // Store session for future reuse
      this.session = {
        cookies,
        userAgent: await page.evaluate(() => navigator.userAgent),
        lastUsed: new Date(),
      };

      return {
        html,
        status: 200,
        cookies,
      };
    } finally {
      await page.close();
      await context.close();
    }
  }

  /**
   * Check if response contains Cloudflare challenge
   */
  private isCloudflareChallenge(html: string): boolean {
    const indicators = [
      'Checking your browser',
      'Cloudflare',
      'Just a moment',
      'Enable JavaScript and cookies',
      'cf-browser-verification',
      'cf_chl_opt',
    ];

    return indicators.some(indicator => html.includes(indicator));
  }

  /**
   * Get or create browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('[BypassManager] Launching Playwright browser...');
      try {
        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
          ],
        });
      } catch (error) {
        console.error('[BypassManager] Failed to launch Playwright browser:', error);
        console.warn('[BypassManager] Cloudflare bypass unavailable. Install Playwright dependencies with: npx playwright install --with-deps');
        throw new Error('Playwright browser unavailable. Cloudflare bypass requires system dependencies. Run: npx playwright install --with-deps');
      }
    }
    return this.browser;
  }

  /**
   * Load HTML with Cheerio for parsing
   */
  loadHtml(html: string) {
    return cheerio.load(html);
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Singleton instance
let bypassManagerInstance: BypassManager | null = null;

export function getBypassManager(): BypassManager {
  if (!bypassManagerInstance) {
    bypassManagerInstance = new BypassManager();
  }
  return bypassManagerInstance;
}
