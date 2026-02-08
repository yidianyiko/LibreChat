/**
 * Default chunk size threshold in bytes (90MB).
 * Below Cloudflare's 100MB limit with buffer for HTTP overhead.
 */
export const DEFAULT_CHUNK_THRESHOLD = 90 * 1024 * 1024;

/**
 * Splits a JSON array of conversations into chunks where each chunk's
 * serialized size stays under the given byte threshold.
 *
 * If a single conversation exceeds the threshold, it gets its own chunk
 * (we can't split individual conversations).
 */
export function splitJsonArrayIntoChunks<T>(
  items: T[],
  maxBytesPerChunk: number,
): T[][] {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  let currentChunk: T[] = [];
  let currentSize = 2; // Account for opening '[' and closing ']'

  for (const item of items) {
    const itemSize = JSON.stringify(item).length;

    // If adding this item would exceed the limit AND the chunk is not empty,
    // finalize the current chunk and start a new one.
    if (currentChunk.length > 0 && currentSize + itemSize + 1 > maxBytesPerChunk) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 2;
    }

    currentChunk.push(item);
    // +1 for the comma separator between items (except the first)
    currentSize += itemSize + (currentChunk.length > 1 ? 1 : 0);
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}
