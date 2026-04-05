# Kids Shorts Scripts

Management scripts for the Kids Shorts app.

## Prerequisites

1. **Environment Variables**: Copy `.env.example` to `.env.local` and fill in:
   - `EXPO_PUBLIC_APPWRITE_ENDPOINT`: Your Appwrite endpoint
   - `EXPO_PUBLIC_APPWRITE_PROJECT_ID`: Your Appwrite project ID
   - `APPWRITE_API_KEY`: Your Appwrite API key (with full permissions)
   - `YOUTUBE_API_KEY`: Your YouTube Data API v3 key

2. **Tools Required**:
   - `yt-dlp`: For downloading videos ([Installation](https://github.com/yt-dlp/yt-dlp#installation))
   - `ffmpeg`: For video transcoding ([Installation](https://ffmpeg.org/download.html))

## Scripts

### 1. Setup Appwrite

Creates the database structure in Appwrite.

```bash
npm run setup:appwrite
```

Creates:
- Database: `kids-shorts-db`
- Collections: `videos`, `channels`
- Storage bucket: `video-files`

### 2. Add Channel

Interactive tool to add YouTube channels to the database.

```bash
npm run add:channel
```

Prompts for:
- YouTube channel ID
- Fetches channel info from YouTube
- Adds channel with `isKidsChannel=true`

### 3. Ingest Videos

Fetches videos from YouTube channels and stores metadata in Appwrite.

```bash
npm run ingest:videos
```

Features:
- Fetches all kids channels from database
- Choose to ingest: shorts only, videos only, or all
- Set limit per channel or process all videos
- Detects shorts (< 60 seconds) automatically
- Skips existing videos

### 4. Download Videos

Downloads videos from YouTube and uploads to Appwrite Storage.

```bash
npm run download:videos

# With options
npm run download:videos -- --limit=10 --quality=720
npm run download:videos -- --test  # Download only, no upload
```

Options:
- `--limit=N`: Process only N videos (default: all)
- `--quality=N`: Video quality 480, 720, or 1080 (default: 720)
- `--test`: Test mode - download only, no upload

Features:
- Select specific channels or all channels
- Choose to upload: shorts only, videos only, or all
- Transcodes to H.264/AAC for Android compatibility
- Checks existing files in storage to avoid duplicates
- 3-second delay between downloads to avoid rate limiting

## Workflow

1. **Initial Setup**:
   ```bash
   npm run setup:appwrite
   ```

2. **Add Channels**:
   ```bash
   npm run add:channel
   # Repeat for each channel
   ```

3. **Ingest Video Metadata**:
   ```bash
   npm run ingest:videos
   ```

4. **Download and Upload Videos**:
   ```bash
   npm run download:videos
   ```

## Notes

- **Video ID Field**: The `videoId` field in the database serves dual purpose:
  - Initially stores the YouTube video ID (11 chars, e.g., `dQw4w9WgXcQ`)
  - After upload, replaced with Appwrite Storage file ID (36 chars UUID)
- Videos without uploaded files are detected by checking if `videoId` length < 20 characters
- The app constructs video URLs using: `{endpoint}/storage/buckets/{bucketId}/files/{videoId}/view?project={projectId}`
- Shorts are automatically detected based on duration (< 60 seconds)
- All videos are transcoded to H.264/AAC for maximum compatibility
