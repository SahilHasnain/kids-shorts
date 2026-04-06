export const appConfig = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
  apiKey: process.env.APPWRITE_API_KEY!,
  youtubeApiKey: process.env.YOUTUBE_API_KEY!,
  databaseId:
    process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID ??
    process.env.APPWRITE_DATABASE_ID ??
    "69d2206900358e41513d",
  videosCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_VIDEOS_COLLECTION_ID ??
    process.env.APPWRITE_VIDEOS_COLLECTION_ID ??
    "69d2206b0018425b9cb5",
  channelsCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID ??
    process.env.APPWRITE_CHANNELS_COLLECTION_ID ??
    "69d22070003313a4fe51",
  storageBucketId:
    process.env.EXPO_PUBLIC_APPWRITE_STORAGE_BUCKET_ID ??
    process.env.APPWRITE_STORAGE_BUCKET_ID ??
    "69d22086002f376ddbb3",
} as const;

export function requireConfig() {
  const missing = [
    ["EXPO_PUBLIC_APPWRITE_ENDPOINT", appConfig.endpoint],
    ["EXPO_PUBLIC_APPWRITE_PROJECT_ID", appConfig.projectId],
    ["APPWRITE_API_KEY", appConfig.apiKey],
    ["YOUTUBE_API_KEY", appConfig.youtubeApiKey],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.map(([key]) => key).join(", ")}`);
  }

  return appConfig;
}
