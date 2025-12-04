import { storage } from "../storage";
import { readLocalFile, getAbsoluteFilePath } from "../localFileStorage";
import type { DeliveryJob } from "@shared/schema";
import fs from "fs/promises";

interface DeliveryResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export class DeliveryService {
  constructor() {
    // Local storage mode
  }

  async sendToKindle(bookId: string, kindleEmail: string): Promise<DeliveryResult> {
    let job: DeliveryJob | undefined;
    
    try {
      const book = await storage.getBookById(bookId);
      if (!book) {
        return { success: false, error: "Book not found" };
      }

      if (!kindleEmail.endsWith("@kindle.com") && !kindleEmail.endsWith("@free.kindle.com")) {
        return { success: false, error: "Invalid Kindle email address. Must end with @kindle.com or @free.kindle.com" };
      }

      const supportedFormats = ["EPUB", "PDF", "MOBI"];
      if (!supportedFormats.includes(book.format.toUpperCase())) {
        return { success: false, error: `Format ${book.format} is not supported for Kindle delivery. Supported formats: ${supportedFormats.join(", ")}` };
      }

      job = await storage.createDeliveryJob({
        itemId: bookId,
        itemType: 'book',
        targetEmail: kindleEmail,
        deliveryType: 'kindle',
        status: 'pending',
        attempts: 0,
      });

      await storage.updateDeliveryJob(job.id, { status: 'sending', attempts: 1 });

      const fileBuffer = await this.getBookFile(book.filePath);
      if (!fileBuffer) {
        await storage.updateDeliveryJob(job.id, { 
          status: 'failed', 
          errorMessage: "Could not retrieve book file" 
        });
        return { success: false, jobId: job.id, error: "Could not retrieve book file" };
      }

      const subject = book.format.toUpperCase() === "MOBI" ? book.title : "convert";
      
      const result = await this.sendEmail({
        to: kindleEmail,
        subject,
        html: `
          <p>Your book "${book.title}" has been sent to your Kindle.</p>
          ${book.author ? `<p>Author: ${book.author}</p>` : ""}
          <p>Sent via Luma</p>
        `,
        attachments: [{
          filename: `${this.sanitizeFilename(book.title)}.${book.format.toLowerCase()}`,
          content: fileBuffer,
          contentType: this.getMimeType(book.format),
        }],
      });

      if (result.success) {
        await storage.updateDeliveryJob(job.id, { 
          status: 'sent',
          sentAt: new Date(),
        });
        return { success: true, jobId: job.id };
      } else {
        await storage.updateDeliveryJob(job.id, { 
          status: 'failed',
          errorMessage: result.error,
        });
        return { success: false, jobId: job.id, error: result.error };
      }
    } catch (error: any) {
      console.error("[DeliveryService] Kindle delivery error:", error);
      if (job) {
        await storage.updateDeliveryJob(job.id, { 
          status: 'failed',
          errorMessage: error.message || "Failed to send to Kindle",
        });
      }
      return { success: false, jobId: job?.id, error: error.message || "Failed to send to Kindle" };
    }
  }

  async sendToEmail(bookId: string, email: string): Promise<DeliveryResult> {
    let job: DeliveryJob | undefined;
    
    try {
      const book = await storage.getBookById(bookId);
      if (!book) {
        return { success: false, error: "Book not found" };
      }

      job = await storage.createDeliveryJob({
        itemId: bookId,
        itemType: 'book',
        targetEmail: email,
        deliveryType: 'email',
        status: 'pending',
        attempts: 0,
      });

      await storage.updateDeliveryJob(job.id, { status: 'sending', attempts: 1 });

      const fileBuffer = await this.getBookFile(book.filePath);
      if (!fileBuffer) {
        await storage.updateDeliveryJob(job.id, { 
          status: 'failed', 
          errorMessage: "Could not retrieve book file" 
        });
        return { success: false, jobId: job.id, error: "Could not retrieve book file" };
      }

      const result = await this.sendEmail({
        to: email,
        subject: `Your Book: ${book.title}`,
        html: `
          <h2>${book.title}</h2>
          ${book.author ? `<p><strong>Author:</strong> ${book.author}</p>` : ""}
          ${book.description ? `<p>${book.description.slice(0, 300)}${book.description.length > 300 ? "..." : ""}</p>` : ""}
          <p>Your book is attached to this email.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">Sent via Luma</p>
        `,
        attachments: [{
          filename: `${this.sanitizeFilename(book.title)}.${book.format.toLowerCase()}`,
          content: fileBuffer,
          contentType: this.getMimeType(book.format),
        }],
      });

      if (result.success) {
        await storage.updateDeliveryJob(job.id, { 
          status: 'sent',
          sentAt: new Date(),
        });
        return { success: true, jobId: job.id };
      } else {
        await storage.updateDeliveryJob(job.id, { 
          status: 'failed',
          errorMessage: result.error,
        });
        return { success: false, jobId: job.id, error: result.error };
      }
    } catch (error: any) {
      console.error("[DeliveryService] Email delivery error:", error);
      if (job) {
        await storage.updateDeliveryJob(job.id, { 
          status: 'failed',
          errorMessage: error.message || "Failed to send email",
        });
      }
      return { success: false, jobId: job?.id, error: error.message || "Failed to send email" };
    }
  }

  async getDeliveryStatus(jobId: string): Promise<DeliveryJob | undefined> {
    return await storage.getDeliveryJob(jobId);
  }

  private async getBookFile(filePath: string): Promise<Buffer | null> {
    try {
      // Handle local storage files
      if (filePath.startsWith('/local-files/')) {
        return await readLocalFile(filePath);
      }
      
      // Handle absolute paths (Calibre imports, file scanner)
      const absolutePath = getAbsoluteFilePath(filePath);
      if (absolutePath) {
        return await fs.readFile(absolutePath);
      }
      
      // Try reading as absolute file path (legacy support)
      try {
        return await fs.readFile(filePath);
      } catch {
        console.error("[DeliveryService] File not found:", filePath);
        return null;
      }
    } catch (error) {
      console.error("[DeliveryService] Error getting book file:", error);
      return null;
    }
  }

  private async sendEmail(params: SendEmailParams): Promise<DeliveryResult> {
    const emailProvider = await this.getEmailProvider();
    
    if (!emailProvider) {
      return { 
        success: false, 
        error: "Email service not configured. Please set up SendGrid or Resend in Settings." 
      };
    }

    try {
      if (emailProvider.type === 'sendgrid') {
        return await this.sendViaSendGrid(params, emailProvider.apiKey);
      } else if (emailProvider.type === 'resend') {
        return await this.sendViaResend(params, emailProvider.apiKey);
      }
      
      return { success: false, error: "Unknown email provider" };
    } catch (error: any) {
      console.error("[DeliveryService] Send email error:", error);
      return { success: false, error: error.message || "Failed to send email" };
    }
  }

  private async getEmailProvider(): Promise<{ type: 'sendgrid' | 'resend'; apiKey: string } | null> {
    const sendgridKey = process.env.SENDGRID_API_KEY;
    if (sendgridKey) {
      return { type: 'sendgrid', apiKey: sendgridKey };
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      return { type: 'resend', apiKey: resendKey };
    }

    const settingSendGrid = await storage.getSetting('sendgridApiKey');
    if (settingSendGrid?.value) {
      return { type: 'sendgrid', apiKey: settingSendGrid.value };
    }

    const settingResend = await storage.getSetting('resendApiKey');
    if (settingResend?.value) {
      return { type: 'resend', apiKey: settingResend.value };
    }

    return null;
  }

  private async sendViaSendGrid(params: SendEmailParams, apiKey: string): Promise<DeliveryResult> {
    const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@luma.app';
    
    const attachments = params.attachments?.map(att => ({
      content: att.content.toString('base64'),
      filename: att.filename,
      type: att.contentType,
      disposition: 'attachment',
    }));

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.to }] }],
        from: { email: senderEmail },
        subject: params.subject,
        content: [{ type: 'text/html', value: params.html }],
        attachments,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[DeliveryService] SendGrid error:", error);
      return { success: false, error: `SendGrid error: ${response.status}` };
    }

    return { success: true };
  }

  private async sendViaResend(params: SendEmailParams, apiKey: string): Promise<DeliveryResult> {
    const senderEmail = process.env.RESEND_FROM_EMAIL || 'noreply@luma.app';
    
    const attachments = params.attachments?.map(att => ({
      content: att.content.toString('base64'),
      filename: att.filename,
    }));

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: senderEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
        attachments,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[DeliveryService] Resend error:", error);
      return { success: false, error: `Resend error: ${response.status}` };
    }

    const result = await response.json();
    return { success: true, jobId: result.id };
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 100);
  }

  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      'epub': 'application/epub+zip',
      'pdf': 'application/pdf',
      'mobi': 'application/x-mobipocket-ebook',
      'cbz': 'application/vnd.comicbook+zip',
      'cbr': 'application/vnd.comicbook-rar',
    };
    return mimeTypes[format.toLowerCase()] || 'application/octet-stream';
  }
}

export const deliveryService = new DeliveryService();
