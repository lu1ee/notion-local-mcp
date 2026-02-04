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
  return `https://notion.so/${cleanId}`;
}

/**
 * Schema property definition from collection
 */
export interface SchemaProperty {
  name: string;
  type: string;
  options?: Array<{
    id: string;
    color?: string;
    value: string;
  }>;
}

export interface ParsedSchema {
  [propertyId: string]: SchemaProperty;
}

/**
 * Parse collection schema JSON
 */
export function parseSchema(schemaJson: string | null): ParsedSchema | null {
  if (!schemaJson) {
    return null;
  }

  try {
    return JSON.parse(schemaJson) as ParsedSchema;
  } catch {
    return null;
  }
}

/**
 * Parsed property value with name and type info
 */
export interface ParsedProperty {
  name: string;
  type: string;
  value: string | string[] | boolean | number | null;
}

export interface ParsedProperties {
  [propertyName: string]: ParsedProperty;
}

/**
 * Parse block properties using schema for context
 */
export function parseProperties(
  propertiesJson: string | null,
  schema: ParsedSchema | null
): ParsedProperties | null {
  if (!propertiesJson) {
    return null;
  }

  try {
    const rawProperties: Properties = JSON.parse(propertiesJson);
    const result: ParsedProperties = {};

    for (const [propId, rawValue] of Object.entries(rawProperties)) {
      if (!rawValue) continue;

      // Get property info from schema
      const schemaInfo = schema?.[propId];
      const propName = schemaInfo?.name || propId;
      const propType = schemaInfo?.type || 'unknown';

      let value: string | string[] | boolean | number | null;

      switch (propType) {
        case 'checkbox':
          // Checkbox values are stored as [["Yes"]] or [["No"]] or empty
          value = extractTextFromRichText(rawValue) === 'Yes';
          break;

        case 'number':
          const numStr = extractTextFromRichText(rawValue);
          value = numStr ? parseFloat(numStr) : null;
          break;

        case 'multi_select':
          // Multi-select values are stored as comma-separated in rich text
          const multiText = extractTextFromRichText(rawValue);
          value = multiText ? multiText.split(',').map((s) => s.trim()) : [];
          break;

        case 'date':
        case 'created_time':
        case 'last_edited_time':
          value = extractTextFromRichText(rawValue);
          break;

        case 'relation':
          // Relations store page IDs in a special format
          value = extractRelationIds(rawValue);
          break;

        default:
          // text, title, select, url, email, phone, etc.
          value = extractTextFromRichText(rawValue);
      }

      result[propName] = {
        name: propName,
        type: propType,
        value,
      };
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Extract relation page IDs from rich text
 */
function extractRelationIds(richText: RichText): string[] {
  const ids: string[] = [];

  for (const segment of richText) {
    if (!Array.isArray(segment) || segment.length < 2) continue;

    const annotations = segment[1];
    if (!Array.isArray(annotations)) continue;

    for (const annotation of annotations) {
      if (Array.isArray(annotation) && annotation[0] === 'p' && annotation[1]) {
        ids.push(annotation[1]);
      }
    }
  }

  return ids;
}

/**
 * Convert schema to a simplified format for display
 */
export function formatSchemaForDisplay(schema: ParsedSchema | null): Record<string, { type: string; options?: string[] }> | null {
  if (!schema) {
    return null;
  }

  const result: Record<string, { type: string; options?: string[] }> = {};

  for (const [, prop] of Object.entries(schema)) {
    const entry: { type: string; options?: string[] } = { type: prop.type };

    if (prop.options && prop.options.length > 0) {
      entry.options = prop.options.map((opt) => opt.value);
    }

    result[prop.name] = entry;
  }

  return result;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '…';
}
