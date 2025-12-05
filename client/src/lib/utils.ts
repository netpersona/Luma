import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely parse a value that might be a JSON string array or an actual array.
 * Returns an empty array if parsing fails or value is null/undefined.
 * This handles the case where database stores arrays as JSON strings.
 */
export function parseJsonArray(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Sanitize HTML content to only allow safe formatting tags.
 * Allowed tags: <p>, <div>, <strong>, <em>, <br>
 * All other tags and attributes are stripped.
 * Also converts common markdown-style formatting to HTML.
 */
export function sanitizeDescription(html: string | null | undefined): string {
  if (!html) return '';
  
  let content = html;
  
  // Convert common markdown-style formatting to HTML
  // Bold: **text** or __text__ -> <strong>text</strong>
  content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  content = content.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Italic: *text* or _text_ -> <em>text</em>
  content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  content = content.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Convert double newlines to paragraph breaks
  content = content.replace(/\n\n+/g, '</p><p>');
  
  // Convert single newlines to line breaks
  content = content.replace(/\n/g, '<br>');
  
  // Wrap in paragraph if not already wrapped
  if (!content.startsWith('<p>') && !content.startsWith('<div>')) {
    content = '<p>' + content + '</p>';
  }
  
  // Parse and sanitize HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  
  // Allowed tags
  const allowedTags = new Set(['P', 'DIV', 'STRONG', 'EM', 'BR', 'B', 'I']);
  
  // Recursive function to sanitize nodes
  function sanitizeNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toUpperCase();
      
      // Convert <b> to <strong> and <i> to <em>
      let newTagName = tagName;
      if (tagName === 'B') newTagName = 'STRONG';
      if (tagName === 'I') newTagName = 'EM';
      
      if (allowedTags.has(tagName)) {
        const newElement = document.createElement(newTagName.toLowerCase());
        
        // Recursively sanitize children
        for (const child of Array.from(node.childNodes)) {
          const sanitizedChild = sanitizeNode(child);
          if (sanitizedChild) {
            newElement.appendChild(sanitizedChild);
          }
        }
        
        return newElement;
      } else {
        // For disallowed tags, just return their text content as a text node
        // But first, try to preserve their children
        const fragment = document.createDocumentFragment();
        for (const child of Array.from(node.childNodes)) {
          const sanitizedChild = sanitizeNode(child);
          if (sanitizedChild) {
            fragment.appendChild(sanitizedChild);
          }
        }
        return fragment;
      }
    }
    
    return null;
  }
  
  // Sanitize the body content
  const fragment = document.createDocumentFragment();
  for (const child of Array.from(doc.body.childNodes)) {
    const sanitizedChild = sanitizeNode(child);
    if (sanitizedChild) {
      fragment.appendChild(sanitizedChild);
    }
  }
  
  // Convert back to HTML string
  const tempDiv = document.createElement('div');
  tempDiv.appendChild(fragment);
  
  // Clean up empty paragraphs
  let result = tempDiv.innerHTML;
  result = result.replace(/<p>\s*<\/p>/g, '');
  result = result.replace(/<div>\s*<\/div>/g, '');
  
  return result;
}
