# Selective Conversation Import

## Overview

LibreChat supports three conversation import modes to meet different use cases:

1. **Full Import** - Quick import of all conversations
2. **Batch Import** - Import a specified range of conversations
3. **Selective Import** - Manually select specific conversations

## Supported Formats

- **LibreChat** - Native export format
- **ChatGPT** - OpenAI ChatGPT export format
- **Claude** - Anthropic Claude export format

## Features

### Duplicate Detection

The system automatically detects existing conversations (via conversationId) and marks duplicates before import.

### Virtual Scrolling

Selective import mode uses virtual scrolling technology for smooth handling of thousands of conversations.

### Batch Processing

- Batch import: Max 500 conversations per request
- Selective import: Max 500 conversations selection
- Full import: Unlimited (backend processing)

### Error Handling

When partial import fails, the system will:
1. Display success/failure statistics
2. List failed conversations with error reasons
3. Provide option to retry failed items

## Usage

### 1. Full Import

Fastest import method, suitable for account migration:

```
1. Click "Import" button
2. Select JSON file
3. Choose "Full Import"
4. Wait for backend processing to complete
```

### 2. Batch Import

Import a specific range of conversations:

```
1. Click "Import" button
2. Select JSON file
3. Choose "Batch Import"
4. Enter range: From conversation X to conversation Y
5. Click "Next"
```

Limits:
- Max 500 conversations per batch
- Range must be valid (1 to total count)

### 3. Selective Import

Manually select specific conversations:

```
1. Click "Import" button
2. Select JSON file
3. Choose "Selective Import"
4. Use search and filter features
5. Check desired conversations (max 500)
6. Click "Import Selected"
```

Features:
- Search by title or content
- Filter by date range
- Virtual scrolling (performance optimization)
- Duplicate conversations auto-marked

## API

### POST /api/convos/import-selective

Import selected conversation array.

**Request:**
```json
{
  "conversations": [
    { /* conversation object */ },
    { /* conversation object */ }
  ]
}
```

**Response:**
```json
{
  "message": "Successfully imported 23 conversations, failed 0",
  "success": [
    { "index": 0, "conversationId": "abc", "title": "..." }
  ],
  "failed": []
}
```

## Architecture

### Frontend

```
ImportConversations
  ├── conversationParser (parse file)
  ├── ImportModeDialog (mode selection)
  ├── SelectiveImportDialog (selective UI)
  │   ├── @tanstack/react-virtual (virtual scrolling)
  │   └── ConversationListItem
  ├── ImportProgressModal (progress display)
  └── ImportResultDialog (result display)
```

### Backend

```
POST /api/convos/import           (full import - existing)
POST /api/convos/import-selective (selective import - new)
  └── importers.js (reuse existing parsing logic)
```

## Performance

- **Small files (<30MB)**: Direct upload, frontend parsing
- **Large files (>30MB)**: Frontend chunked upload
- **Virtual scrolling**: Supports 10,000+ conversations smooth display
- **Batch import**: 20 conversations per batch, sequential upload

## Troubleshooting

### File Parsing Failed

Confirm file format:
- LibreChat: `{ conversationId, messages, ... }`
- ChatGPT: `[{ id, mapping, title, ... }]`
- Claude: `[{ uuid, chat_messages, ... }]`

### Partial Import Failed

Check error messages in failed list:
- Validation failed: Incomplete data format
- Duplicate conversation: conversationId already exists
- Permission issue: Endpoint configuration error

### Performance Issues

- Use batch import instead of selective import (if you don't need to pick specific conversations)
- Large files prefer full import (backend processing is faster)
