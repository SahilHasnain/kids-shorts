# Kids Shorts Admin

Next.js admin panel for the `kids-shorts` repo.

## What It Covers

- Source management for YouTube channels and playlists
- Metadata ingestion into the `videos` collection
- Upload queue inspection and video file uploads to Appwrite Storage
- Database/source inspection with shorts vs long-video breakdowns

## Environment

`admin/.env.local` should mirror the parent repo’s `kids-shorts/.env.local`.

Required values:

- `EXPO_PUBLIC_APPWRITE_ENDPOINT`
- `EXPO_PUBLIC_APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `YOUTUBE_API_KEY`

Optional admin overrides:

- `EXPO_PUBLIC_APPWRITE_DATABASE_ID`
- `EXPO_PUBLIC_APPWRITE_VIDEOS_COLLECTION_ID`
- `EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID`
- `EXPO_PUBLIC_APPWRITE_STORAGE_BUCKET_ID`

If those overrides are missing, the admin falls back to the current `kids-shorts` IDs in [`config.ts`](C:/Users/MD%20SAHIL%20HASNAIN/Desktop/Projects/kids-shorts/admin/lib/config.ts).

## Run

```bash
npm install
npm run dev
```
