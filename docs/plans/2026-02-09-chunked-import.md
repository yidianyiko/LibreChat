# Chunked Import (Large File Splitting) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to import large ChatGPT export files by automatically splitting them into chunks on the frontend, ensuring reliable uploads.

**Architecture:** When a user selects a JSON file larger than a configurable threshold (default 30MB), the frontend reads the file, parses the top-level JSON array, splits it into chunks that each serialize to <30MB, and uploads each chunk sequentially via the existing `/api/convos/import` endpoint. The progress modal shows real chunk-level progress (e.g., "Uploading chunk 2/5"). No backend changes needed — each chunk is a valid ChatGPT export array.

**Tech Stack:** React, TypeScript, FileReader API, existing TanStack Query mutation

---

## Design Notes

### Why 30MB threshold?
Conservative limit chosen to ensure reliable uploads across various network conditions and server configurations, with buffer for HTTP headers, multipart boundaries, and FormData overhead.

### Why not stream-parse?
213MB JSON is manageable in browser memory (~400-600MB peak). Stream parsing adds complexity (extra deps, Web Workers) for marginal benefit. If users hit memory issues on low-end devices, we can add stream parsing later.

### Chunk splitting strategy
We can't split the JSON array by byte offset (would break JSON structure). Instead:
1. Parse the full array into JS objects
2. Iterate conversations, accumulating into a chunk
3. When adding the next conversation would push the chunk's serialized size over the threshold, start a new chunk
4. To avoid serializing the entire chunk on every addition, we estimate each conversation's size by `JSON.stringify(conv).length` and track a running total

### Error handling
- If any chunk fails to upload, stop and report the error with which chunk failed
- Already-uploaded chunks are safely persisted (each is an independent import)
- User can retry by re-importing the same file (duplicate conversations are handled by the backend generating new IDs)

### What changes

| File | Change |
|------|--------|
| `client/src/utils/importChunker.ts` | **NEW** — Pure utility to split JSON array into chunks |
| `client/src/components/Nav/SettingsTabs/Data/ImportConversations.tsx` | Modify `handleFileUpload` to detect large files and use chunked upload |
| `client/src/components/Nav/SettingsTabs/Data/ImportProgressModal.tsx` | Add chunk progress display (e.g., "Chunk 2/5") |
| `client/src/locales/en/translation.json` | Add new i18n keys for chunk progress |
| `client/src/utils/importChunker.test.ts` | **NEW** — Unit tests for the chunker |

---

## Task 1: Create the chunk splitter utility

**Files:**
- Create: `client/src/utils/importChunker.ts`
- Test: `client/src/utils/importChunker.test.ts`

### Step 1: Write the failing tests

Create `client/src/utils/importChunker.test.ts`:

```typescript
import { splitJsonArrayIntoChunks } from './importChunker';

describe('splitJsonArrayIntoChunks', () => {
  it('returns a single chunk when data is under the threshold', () => {
    const data = [{ title: 'conv1' }, { title: 'conv2' }];
    const chunks = splitJsonArrayIntoChunks(data, 1024 * 1024); // 1MB
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(data);
  });

  it('splits into multiple chunks when data exceeds threshold', () => {
    // Each conversation is ~50 bytes serialized. With threshold of 100 bytes,
    // we should get multiple chunks.
    const data = Array.from({ length: 10 }, (_, i) => ({
      title: `Conversation ${i}`,
      mapping: { id: `msg-${i}` },
    }));
    const chunks = splitJsonArrayIntoChunks(data, 100);
    expect(chunks.length).toBeGreaterThan(1);
    // All conversations should be present across all chunks
    const allConvos = chunks.flat();
    expect(allConvos).toHaveLength(10);
  });

  it('handles a single conversation that exceeds the threshold', () => {
    const bigConvo = { title: 'big', data: 'x'.repeat(200) };
    const chunks = splitJsonArrayIntoChunks([bigConvo], 100);
    // Must still include it — can't split a single conversation
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual([bigConvo]);
  });

  it('returns empty array for empty input', () => {
    const chunks = splitJsonArrayIntoChunks([], 1024);
    expect(chunks).toHaveLength(0);
  });

  it('preserves conversation order across chunks', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const chunks = splitJsonArrayIntoChunks(data, 50);
    const allIds = chunks.flat().map((c: any) => c.id);
    expect(allIds).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd client && npx jest --config jest.config.cjs src/utils/importChunker.test.ts --no-coverage 2>&1 | tail -20`
Expected: FAIL — module not found

### Step 3: Implement the chunk splitter

Create `client/src/utils/importChunker.ts`:

```typescript
/**
 * Default chunk size threshold in bytes (30MB).
 * Conservative limit to ensure reliable uploads with buffer for HTTP overhead.
 */
export const DEFAULT_CHUNK_THRESHOLD = 30 * 1024 * 1024;

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
```

### Step 4: Run tests to verify they pass

Run: `cd client && npx jest --config jest.config.cjs src/utils/importChunker.test.ts --no-coverage 2>&1 | tail -20`
Expected: PASS — all 5 tests pass

### Step 5: Commit

```bash
git add client/src/utils/importChunker.ts client/src/utils/importChunker.test.ts
git commit -m "feat: add JSON array chunk splitter utility for large import files"
```

---

## Task 2: Add i18n keys for chunk progress

**Files:**
- Modify: `client/src/locales/en/translation.json`

### Step 1: Add new locale keys

Find the existing import keys (around line 1037) and add after `"com_ui_importing"`:

```json
"com_ui_import_chunk_progress": "Uploading batch {{current}} of {{total}}...",
"com_ui_import_chunk_parsing": "Splitting large file into batches..."
```

### Step 2: Commit

```bash
git add client/src/locales/en/translation.json
git commit -m "feat: add i18n keys for chunked import progress"
```

---

## Task 3: Update ImportProgressModal to show chunk progress

**Files:**
- Modify: `client/src/components/Nav/SettingsTabs/Data/ImportProgressModal.tsx`

### Step 1: Add chunk progress props and display

Add optional `chunkProgress` props to `ImportProgressModalProps`:

```typescript
interface ImportProgressModalProps {
  open: boolean;
  fileName: string;
  isComplete: boolean;
  isError: boolean;
  onClose: () => void;
  /** Current chunk being uploaded (1-indexed). Undefined means single upload. */
  currentChunk?: number;
  /** Total number of chunks. */
  totalChunks?: number;
}
```

Update the component signature to accept the new props:

```typescript
export default function ImportProgressModal({
  open,
  fileName,
  isComplete,
  isError,
  onClose,
  currentChunk,
  totalChunks,
}: ImportProgressModalProps) {
```

Replace the simulated progress `useEffect` (lines 34-67) — when `currentChunk`/`totalChunks` are set, derive progress from chunk progress instead of simulating:

```typescript
  // Derive progress from chunk state when available
  useEffect(() => {
    if (currentChunk != null && totalChunks != null && totalChunks > 0) {
      // Each chunk contributes equally. Within a chunk, simulate 0-90%.
      const chunkWeight = 100 / totalChunks;
      const completedChunksProgress = (currentChunk - 1) * chunkWeight;
      // Simulate intra-chunk progress up to 90% of this chunk's weight
      const intraChunkTarget = chunkWeight * 0.9;
      setProgress(completedChunksProgress + intraChunkTarget);
    }
  }, [currentChunk, totalChunks]);
```

In the display area, after the file name, add a chunk indicator when `totalChunks > 1`:

```tsx
{totalChunks != null && totalChunks > 1 && currentChunk != null && (
  <span className="text-xs text-gray-500 dark:text-gray-400">
    {localize('com_ui_import_chunk_progress', {
      current: String(currentChunk),
      total: String(totalChunks),
    })}
  </span>
)}
```

### Step 2: Commit

```bash
git add client/src/components/Nav/SettingsTabs/Data/ImportProgressModal.tsx
git commit -m "feat: show chunk progress in import progress modal"
```

---

## Task 4: Integrate chunked upload into ImportConversations

**Files:**
- Modify: `client/src/components/Nav/SettingsTabs/Data/ImportConversations.tsx`

This is the main integration task. We modify `handleFileUpload` to:
1. Check if file size exceeds threshold
2. If so, read the file, parse JSON, split into chunks, and upload sequentially
3. Update chunk progress state for the modal

### Step 1: Add chunk state and modify handleFileUpload

Add new state variables after the existing state declarations (line 21):

```typescript
const [currentChunk, setCurrentChunk] = useState<number | undefined>(undefined);
const [totalChunks, setTotalChunks] = useState<number | undefined>(undefined);
```

Update `resetProgressState` to also reset chunk state:

```typescript
const resetProgressState = useCallback(() => {
  setShowProgressModal(false);
  setFileName('');
  setIsComplete(false);
  setIsError(false);
  setCurrentChunk(undefined);
  setTotalChunks(undefined);
}, []);
```

Replace `handleFileUpload` (lines 74-104) with:

```typescript
const CHUNK_THRESHOLD = 30 * 1024 * 1024; // 30MB

const uploadSingleFile = useCallback(
  (file: File | Blob, fileName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file, encodeURIComponent(fileName));
      uploadFile.mutate(formData, {
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      });
    });
  },
  [uploadFile],
);

const handleFileUpload = useCallback(
  async (file: File) => {
    try {
      const startupConfig = queryClient.getQueryData<TStartupConfig>([QueryKeys.startupConfig]);
      const maxFileSize = startupConfig?.conversationImportMaxFileSize;

      // For small files, upload directly (original behavior)
      if (file.size < CHUNK_THRESHOLD) {
        if (maxFileSize && file.size > maxFileSize) {
          const size = (maxFileSize / (1024 * 1024)).toFixed(2);
          showToast({
            message: localize('com_error_files_upload_too_large', { 0: size }),
            status: NotificationSeverity.ERROR,
          });
          setIsUploading(false);
          resetProgressState();
          return;
        }
        const formData = new FormData();
        formData.append('file', file, encodeURIComponent(file.name || 'File'));
        uploadFile.mutate(formData);
        return;
      }

      // Large file: read, parse, and split into chunks
      const text = await file.text();
      let jsonData: unknown[];
      try {
        jsonData = JSON.parse(text);
      } catch {
        showToast({
          message: localize('com_ui_import_conversation_file_type_error'),
          status: NotificationSeverity.ERROR,
        });
        setIsUploading(false);
        resetProgressState();
        return;
      }

      if (!Array.isArray(jsonData)) {
        // Non-array format can't be chunked — try uploading as-is
        const formData = new FormData();
        formData.append('file', file, encodeURIComponent(file.name || 'File'));
        uploadFile.mutate(formData);
        return;
      }

      const { splitJsonArrayIntoChunks } = await import('~/utils/importChunker');
      const chunks = splitJsonArrayIntoChunks(jsonData, CHUNK_THRESHOLD);

      if (chunks.length <= 1) {
        // Didn't actually need splitting
        const formData = new FormData();
        formData.append('file', file, encodeURIComponent(file.name || 'File'));
        uploadFile.mutate(formData);
        return;
      }

      setTotalChunks(chunks.length);

      for (let i = 0; i < chunks.length; i++) {
        setCurrentChunk(i + 1);
        const chunkJson = JSON.stringify(chunks[i]);
        const blob = new Blob([chunkJson], { type: 'application/json' });
        const chunkFileName = `${file.name.replace('.json', '')}_part${i + 1}.json`;
        await uploadSingleFile(blob, chunkFileName);
      }

      // All chunks uploaded successfully
      setIsComplete(true);
      setIsUploading(false);
      queryClient.invalidateQueries([QueryKeys.allConversations]);
      showToast({
        message: localize('com_ui_import_conversation_success'),
        status: NotificationSeverity.SUCCESS,
      });
    } catch (error) {
      logger.error('File processing error:', error);
      setIsUploading(false);
      setIsError(true);
      showToast({
        message: localize('com_ui_import_conversation_error'),
        status: NotificationSeverity.ERROR,
      });
    }
  },
  [uploadFile, uploadSingleFile, showToast, localize, queryClient, resetProgressState],
);
```

### Step 2: Pass chunk props to ImportProgressModal

Update the `<ImportProgressModal>` JSX (around line 169):

```tsx
<ImportProgressModal
  open={showProgressModal}
  fileName={fileName}
  isComplete={isComplete}
  isError={isError}
  onClose={resetProgressState}
  currentChunk={currentChunk}
  totalChunks={totalChunks}
/>
```

### Step 3: Also update useImportConversations hook

Apply the same changes to `client/src/hooks/Conversations/useImportConversations.ts` since it contains a parallel implementation of the same logic. Add the same `currentChunk`/`totalChunks` state, chunked upload logic, and return the new state values:

```typescript
return {
  fileInputRef,
  isUploading,
  handleFileChange,
  handleImportClick,
  showProgressModal,
  fileName,
  isComplete,
  isError,
  resetProgressState,
  currentChunk,
  totalChunks,
};
```

### Step 4: Build the frontend to verify no type errors

Run: `cd client && npx tsc --noEmit 2>&1 | tail -20`
Expected: No errors

### Step 5: Commit

```bash
git add client/src/components/Nav/SettingsTabs/Data/ImportConversations.tsx \
        client/src/hooks/Conversations/useImportConversations.ts
git commit -m "feat: auto-split large import files into chunks to bypass Cloudflare limit"
```

---

## Task 5: Build and deploy

### Step 1: Build packages and frontend

Run: `npm run frontend 2>&1 | tail -20`
Expected: Build succeeds

### Step 2: Deploy to server

Run: `./deploy.sh`

### Step 3: Verify on server

Have the user try importing the 213MB file via `https://keep4oforever.com`.

### Step 4: Commit any final fixes and tag

```bash
git add -A
git commit -m "chore: production build for chunked import"
```
