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
