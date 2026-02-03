/**
 * Notion stores properties in a complex JSON format.
 * This module provides utilities to extract human-readable content.
 *
 * Example formats:
 * - Simple text: {"title":[["Hello World"]]}
 * - Formatted: {"title":[["Hello",["b"]],[" "],["World",["i"]]]}
 * - With link: {"title":[["‣",[["p","uuid-here"]]]]}
 * - Rich text: [["text"],["more text",["b","i"]]]
 */

type RichTextSegment = [string] | [string, Array<string | [string, string]>];
type RichText = RichTextSegment[];

interface Properties {
  title?: RichText;
  [key: string]: RichText | undefined;
}

/**
 * Extract plain text from a rich text array
 */
export function extractTextFromRichText(richText: RichText | undefined): string {
  if (!richText || !Array.isArray(richText)) {
    return '';
  }

  return richText
    .map((segment) => {
      if (!Array.isArray(segment)) {
        return '';
      }
      if (segment.length < 1) {
        return '';
      }
      const text = segment[0];
      if (typeof text !== 'string') {
        return '';
      }
      // Skip the page reference character
      if (text === '‣') {
        return '';
      }
      return text;
    })
    .join('')
    .trim();
}

/**
 * Extract title from Notion properties JSON string
 */
export function extractTitle(propertiesJson: string | null): string {
  if (!propertiesJson) {
    return '';
  }

  try {
    const properties: Properties = JSON.parse(propertiesJson);
    return extractTextFromRichText(properties.title);
  } catch {
    return '';
  }
}

/**
 * Extract all text content from properties
 */
export function extractAllText(propertiesJson: string | null): string {
  if (!propertiesJson) {
    return '';
  }

  try {
    const properties: Properties = JSON.parse(propertiesJson);
    const texts: string[] = [];

    for (const key of Object.keys(properties)) {
      const value = properties[key];
      if (Array.isArray(value)) {
        const text = extractTextFromRichText(value);
        if (text) {
          texts.push(text);
        }
      }
    }

    return texts.join(' ').trim();
  } catch {
    return '';
  }
}

/**
 * Format timestamp to readable date string
 */
export function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) {
    return '';
  }
  // Notion timestamps are in milliseconds
  return new Date(timestamp).toISOString();
}

/**
 * Format UUID to Notion URL format (with dashes)
 */
export function formatNotionId(id: string): string {
  // Notion IDs are UUIDs without dashes in the database
  if (id.includes('-')) {
    return id;
  }
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

/**
 * Create a Notion URL from page ID
 */
export function createNotionUrl(pageId: string): string {
  const cleanId = pageId.replace(/-/g, '');
  return `notion://www.notion.so/${cleanId}`;
}
