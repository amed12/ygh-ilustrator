import { DeckList } from '../types';

/**
 * Decodes base64 string to Uint8Array safely across Browser and Node.js environments.
 */
function decodeBase64(str: string): Uint8Array {
  // Standardize base64 url-safe formats (replacing '-' with '+' and '_' with '/')
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const binaryString = window.atob(normalized);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } else {
    const buffer = Buffer.from(normalized, 'base64');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
}

/**
 * Parses YDKE format URL string:
 * e.g., ydke://[main_b64]![extra_b64]![side_b64]!
 * Each segment contains concatenated 4-byte little-endian card passcode integers.
 */
export function parseYDKE(ydkeUrl: string): DeckList {
  const result: DeckList = { main: [], extra: [], side: [] };
  
  // Clean url string
  const prefix = 'ydke://';
  if (!ydkeUrl.startsWith(prefix)) {
    throw new Error('Invalid YDKE format: Missing "ydke://" prefix.');
  }
  
  const content = ydkeUrl.slice(prefix.length);
  // Split by '!'
  const segments = content.split('!');
  
  const parseSegment = (b64: string): string[] => {
    if (!b64 || b64.trim() === '') return [];
    try {
      const bytes = decodeBase64(b64.trim());
      const ids: string[] = [];
      // Read 4 bytes at a time as 32-bit LE integer
      for (let i = 0; i <= bytes.length - 4; i += 4) {
        const idVal = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
        if (idVal > 0) {
          ids.push(String(idVal));
        }
      }
      return ids;
    } catch (e) {
      console.error('Failed to parse YDKE segment:', e);
      return [];
    }
  };

  if (segments.length > 0) result.main = parseSegment(segments[0]);
  if (segments.length > 1) result.extra = parseSegment(segments[1]);
  if (segments.length > 2) result.side = parseSegment(segments[2]);
  
  return result;
}

/**
 * Parses .ydk text format.
 * Format is line-by-line card IDs under headers:
 * #main
 * #extra
 * !side
 */
export function parseYDK(text: string): DeckList {
  const result: DeckList = { main: [], extra: [], side: [] };
  
  const lines = text.split(/\r?\n/);
  let currentSection: 'main' | 'extra' | 'side' | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check section header
    if (trimmed === '#main') {
      currentSection = 'main';
    } else if (trimmed === '#extra') {
      currentSection = 'extra';
    } else if (trimmed === '!side') {
      currentSection = 'side';
    } else if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
      // Ignored comments or headers
      continue;
    } else {
      // It should be a card passcode number
      if (currentSection && /^\d+$/.test(trimmed)) {
        result[currentSection].push(trimmed);
      }
    }
  }
  
  return result;
}

/**
 * Detects the input format (YDKE vs YDK text) and parses it into a DeckList.
 */
export function parseDeck(input: string): DeckList {
  const trimmed = input.trim();
  if (trimmed.startsWith('ydke://')) {
    return parseYDKE(trimmed);
  } else if (trimmed.includes('#main') || trimmed.includes('#extra') || trimmed.includes('!side')) {
    return parseYDK(trimmed);
  } else {
    // If it's a list of IDs separated by newlines/spaces, default to YDK Main
    const ids = trimmed.split(/[\s,\n]+/).filter(id => /^\d+$/.test(id));
    if (ids.length > 0) {
      return { main: ids, extra: [], side: [] };
    }
    throw new Error('Unsupported deck format. Please paste a valid YDKE URL, YDK text, or a list of card IDs.');
  }
}
