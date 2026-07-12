import { ComboRoute, ComboHandContext, DeckList } from '../types';
import { parseComboRouteRaw, parseHandContextRaw } from './comboIO';

export interface ShareableCombo {
  version: '1.0';
  route: ComboRoute;
  handContext?: ComboHandContext;
  /** Included so a recipient without this deck loaded can open the link and practice immediately. */
  deckList?: DeckList;
}

const HASH_PARAM = 'share';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function readAllChunks(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  chunks.forEach(c => { out.set(c, offset); offset += c.length; });
  return out;
}

async function gzipCompress(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(new Uint8Array(bytes));
  writer.close();
  return readAllChunks(cs.readable);
}

async function gzipDecompress(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(bytes));
  writer.close();
  return readAllChunks(ds.readable);
}

/**
 * Encodes a combo (optionally bundled with its deck + hand context) into a URL-safe string
 * suitable for a `#share=` fragment. Uses gzip compression when the browser supports the
 * Compression Streams API, falling back to uncompressed JSON otherwise — a 1-character
 * marker prefix records which was used so decode() doesn't need to guess.
 */
export async function encodeShareableCombo(payload: ShareableCombo): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));

  if (typeof CompressionStream !== 'undefined') {
    try {
      const compressed = await gzipCompress(bytes);
      return `c:${bytesToBase64Url(compressed)}`;
    } catch {
      // Fall through to uncompressed encoding below.
    }
  }
  return `r:${bytesToBase64Url(bytes)}`;
}

/**
 * Decodes a string previously produced by encodeShareableCombo. Returns null (never throws)
 * if the payload is malformed, corrupted, or fails structural validation.
 */
export async function decodeShareableCombo(encoded: string): Promise<ShareableCombo | null> {
  try {
    const sepIdx = encoded.indexOf(':');
    if (sepIdx === -1) return null;
    const marker = encoded.slice(0, sepIdx);
    const bytes = base64UrlToBytes(encoded.slice(sepIdx + 1));

    let jsonBytes: Uint8Array;
    if (marker === 'c') {
      if (typeof DecompressionStream === 'undefined') return null;
      jsonBytes = await gzipDecompress(bytes);
    } else if (marker === 'r') {
      jsonBytes = bytes;
    } else {
      return null;
    }

    const parsed = JSON.parse(new TextDecoder().decode(jsonBytes));
    return validateShareableCombo(parsed);
  } catch {
    return null;
  }
}

function validateShareableCombo(raw: unknown): ShareableCombo | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (data.version !== '1.0') return null;

  const route = parseComboRouteRaw(data.route);
  if (!route) return null;

  let deckList: DeckList | undefined;
  if (data.deckList && typeof data.deckList === 'object') {
    const d = data.deckList as Record<string, unknown>;
    if (Array.isArray(d.main) && Array.isArray(d.extra) && Array.isArray(d.side)) {
      deckList = {
        main: d.main.map(String),
        extra: d.extra.map(String),
        side: d.side.map(String)
      };
    }
  }

  return {
    version: '1.0',
    route,
    handContext: parseHandContextRaw(data.handContext),
    deckList
  };
}

/** Builds a full shareable URL for the given combo, using the current page's origin/path. */
export async function buildShareUrl(payload: ShareableCombo): Promise<string> {
  const encoded = await encodeShareableCombo(payload);
  const url = new URL(window.location.href);
  url.hash = `${HASH_PARAM}=${encoded}`;
  return url.toString();
}

/** Reads a `#share=...` fragment from the current URL, if present. */
export function readShareParamFromLocation(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith(`#${HASH_PARAM}=`)) return null;
  return hash.slice(`#${HASH_PARAM}=`.length);
}

/** Removes the `#share=...` fragment from the URL without triggering a reload. */
export function clearShareParamFromLocation(): void {
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(null, '', url.toString());
}
