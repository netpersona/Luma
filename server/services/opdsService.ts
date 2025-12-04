import * as cheerio from "cheerio";
import { storage } from "../storage";
import type { OpdsSource, InsertOpdsSource } from "@shared/schema";

export interface OpdsEntry {
  id: string;
  title: string;
  author?: string;
  summary?: string;
  updated?: string;
  coverUrl?: string;
  links: OpdsLink[];
  categories?: string[];
}

export interface OpdsLink {
  href: string;
  type: string;
  rel?: string;
  title?: string;
}

export interface OpdsFeed {
  id: string;
  title: string;
  updated?: string;
  entries: OpdsEntry[];
  links: OpdsLink[];
  totalResults?: number;
  startIndex?: number;
  itemsPerPage?: number;
}

export interface OpdsFetchResult {
  success: boolean;
  feed?: OpdsFeed;
  error?: string;
}

export interface OpdsDownloadResult {
  success: boolean;
  data?: Buffer;
  contentType?: string;
  filename?: string;
  error?: string;
}

class OpdsService {
  private async fetchWithAuth(
    url: string,
    username?: string | null,
    password?: string | null
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/atom+xml, application/xml, text/xml",
      "User-Agent": "Luma/1.0",
    };

    if (username && password) {
      const credentials = Buffer.from(`${username}:${password}`).toString("base64");
      headers.Authorization = `Basic ${credentials}`;
    }

    const response = await fetch(url, { headers });
    return response;
  }

  async fetchFeed(url: string, source?: OpdsSource): Promise<OpdsFetchResult> {
    try {
      const response = await this.fetchWithAuth(
        url,
        source?.username,
        source?.password
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch feed: ${response.status} ${response.statusText}`,
        };
      }

      const xml = await response.text();
      const feed = this.parseFeed(xml, url);

      return { success: true, feed };
    } catch (error: any) {
      console.error("[OPDS] Error fetching feed:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch OPDS feed",
      };
    }
  }

  private parseFeed(xml: string, baseUrl: string): OpdsFeed {
    const $ = cheerio.load(xml, { xmlMode: true });
    const baseUrlObj = new URL(baseUrl);

    const resolveUrl = (href: string): string => {
      if (!href) return "";
      if (href.startsWith("http://") || href.startsWith("https://")) {
        return href;
      }
      if (href.startsWith("/")) {
        return `${baseUrlObj.origin}${href}`;
      }
      const basePath = baseUrl.replace(/\/[^/]*$/, "/");
      return `${basePath}${href}`;
    };

    const feed: OpdsFeed = {
      id: $("feed > id").text() || baseUrl,
      title: $("feed > title").text() || "OPDS Feed",
      updated: $("feed > updated").text(),
      entries: [],
      links: [],
    };

    const totalResults = $("feed > opensearch\\:totalResults, feed > totalResults").text();
    if (totalResults) feed.totalResults = parseInt(totalResults, 10);
    
    const startIndex = $("feed > opensearch\\:startIndex, feed > startIndex").text();
    if (startIndex) feed.startIndex = parseInt(startIndex, 10);
    
    const itemsPerPage = $("feed > opensearch\\:itemsPerPage, feed > itemsPerPage").text();
    if (itemsPerPage) feed.itemsPerPage = parseInt(itemsPerPage, 10);

    $("feed > link").each((_, el) => {
      const $link = $(el);
      feed.links.push({
        href: resolveUrl($link.attr("href") || ""),
        type: $link.attr("type") || "",
        rel: $link.attr("rel"),
        title: $link.attr("title"),
      });
    });

    $("feed > entry").each((_, el) => {
      const $entry = $(el);
      const entry: OpdsEntry = {
        id: $entry.find("> id").text(),
        title: $entry.find("> title").text(),
        summary: $entry.find("> summary, > content").text(),
        updated: $entry.find("> updated").text(),
        links: [],
        categories: [],
      };

      const $author = $entry.find("> author > name");
      if ($author.length) {
        entry.author = $author.text();
      }

      $entry.find("> link").each((_, linkEl) => {
        const $link = $(linkEl);
        const href = resolveUrl($link.attr("href") || "");
        const type = $link.attr("type") || "";
        const rel = $link.attr("rel") || "";

        entry.links.push({ href, type, rel, title: $link.attr("title") });

        if (
          rel.includes("image") ||
          rel.includes("thumbnail") ||
          type.startsWith("image/")
        ) {
          if (!entry.coverUrl) {
            entry.coverUrl = href;
          }
        }
      });

      $entry.find("> category").each((_, catEl) => {
        const label = $(catEl).attr("label") || $(catEl).attr("term");
        if (label) entry.categories?.push(label);
      });

      feed.entries.push(entry);
    });

    return feed;
  }

  getNavigationLinks(feed: OpdsFeed): { [key: string]: OpdsLink | undefined } {
    return {
      self: feed.links.find(l => l.rel === "self"),
      start: feed.links.find(l => l.rel === "start"),
      up: feed.links.find(l => l.rel === "up"),
      next: feed.links.find(l => l.rel === "next"),
      previous: feed.links.find(l => l.rel === "previous" || l.rel === "prev"),
      search: feed.links.find(l => l.rel === "search"),
    };
  }

  getAcquisitionLinks(entry: OpdsEntry): OpdsLink[] {
    return entry.links.filter(
      l =>
        l.rel?.includes("acquisition") ||
        l.rel?.includes("enclosure") ||
        l.type?.includes("epub") ||
        l.type?.includes("pdf") ||
        l.type?.includes("mobi") ||
        l.type?.includes("application/x-mobipocket") ||
        l.type?.includes("text/plain") ||
        l.type?.includes("text/html") ||
        l.type?.includes("application/zip") ||
        l.href?.match(/\.(epub|pdf|mobi|azw|azw3|txt|html|zip)$/i)
    );
  }

  getSubsectionLinks(entry: OpdsEntry): OpdsLink[] {
    return entry.links.filter(
      l =>
        l.rel === "subsection" ||
        l.type?.includes("atom+xml") ||
        l.type?.includes("navigation")
    );
  }

  isNavigationEntry(entry: OpdsEntry): boolean {
    return entry.links.some(
      l =>
        l.rel === "subsection" ||
        l.type?.includes("navigation") ||
        l.type?.includes("atom+xml;profile=opds-catalog")
    );
  }

  async downloadBook(
    url: string,
    source?: OpdsSource
  ): Promise<OpdsDownloadResult> {
    try {
      const response = await this.fetchWithAuth(
        url,
        source?.username,
        source?.password
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Download failed: ${response.status} ${response.statusText}`,
        };
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const contentDisposition = response.headers.get("content-disposition");
      
      let filename = "download";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, "");
        }
      } else {
        const urlPath = new URL(url).pathname;
        const urlFilename = urlPath.split("/").pop();
        if (urlFilename && urlFilename.includes(".")) {
          filename = urlFilename;
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = Buffer.from(arrayBuffer);

      return {
        success: true,
        data,
        contentType,
        filename,
      };
    } catch (error: any) {
      console.error("[OPDS] Download error:", error);
      return {
        success: false,
        error: error.message || "Download failed",
      };
    }
  }

  async createSource(source: InsertOpdsSource): Promise<OpdsSource> {
    return await storage.createOpdsSource(source);
  }

  async getSources(): Promise<OpdsSource[]> {
    return await storage.getOpdsSources();
  }

  async getSource(id: string): Promise<OpdsSource | undefined> {
    return await storage.getOpdsSource(id);
  }

  async updateSource(id: string, updates: Partial<InsertOpdsSource>): Promise<OpdsSource | undefined> {
    return await storage.updateOpdsSource(id, updates);
  }

  async deleteSource(id: string): Promise<void> {
    return await storage.deleteOpdsSource(id);
  }

  async testSource(url: string, username?: string, password?: string): Promise<{ valid: boolean; error?: string; title?: string }> {
    try {
      const mockSource = username && password ? { username, password } as OpdsSource : undefined;
      const result = await this.fetchFeed(url, mockSource);
      
      if (result.success && result.feed) {
        return { valid: true, title: result.feed.title };
      }
      
      return { valid: false, error: result.error || "Invalid OPDS feed" };
    } catch (error: any) {
      return { valid: false, error: error.message || "Failed to validate feed" };
    }
  }
}

export const opdsService = new OpdsService();
