import { ID } from "node-appwrite";
import { appConfig } from "@/lib/config";
import { getAppwriteClient, Query } from "@/lib/appwrite";
import {
  fetchChannelInfo,
  fetchPlaylistInfo,
  type YouTubeSourceInfo,
} from "@/lib/youtube";

export interface ChannelInfo extends YouTubeSourceInfo {
  ignoreDuration?: boolean;
  includeShorts?: boolean;
}

interface StoredChannel {
  $id: string;
  youtubeChannelId: string;
  name: string;
  type?: string;
  ignoreDuration?: boolean;
  includeShorts?: boolean;
}

interface StoredVideo {
  $id: string;
  channelId: string;
  videoId?: string | null;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}

export interface AddChannelResult extends ActionResult {
  channel?: unknown;
}

export interface DeleteChannelResult extends ActionResult {
  deletedVideos?: number;
  deletedFiles?: number;
}

export async function fetchYouTubeChannelInfo(channelId: string, apiKey: string) {
  return fetchChannelInfo(channelId, apiKey);
}

export async function fetchYouTubePlaylistInfo(playlistId: string, apiKey: string) {
  return fetchPlaylistInfo(playlistId, apiKey);
}

export async function getAllChannels() {
  const { databases } = getAppwriteClient();
  const allChannels: StoredChannel[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await databases.listDocuments(appConfig.databaseId, appConfig.channelsCollectionId, [
      Query.limit(limit),
      Query.offset(offset),
    ]);

    allChannels.push(...(response.documents as unknown as StoredChannel[]));

    if (response.documents.length < limit) {
      break;
    }

    offset += limit;
  }

  return allChannels;
}

export async function channelExists(youtubeChannelId: string) {
  const { databases } = getAppwriteClient();
  const response = await databases.listDocuments(appConfig.databaseId, appConfig.channelsCollectionId, [
    Query.equal("youtubeChannelId", youtubeChannelId),
    Query.limit(1),
  ]);

  return response.documents.length > 0;
}

export async function addChannel(channelInfo: ChannelInfo): Promise<AddChannelResult> {
  const { databases } = getAppwriteClient();

  try {
    if (await channelExists(channelInfo.youtubeChannelId)) {
      return { success: false, error: "Channel already exists in the database" };
    }

    const channel = await databases.createDocument(
      appConfig.databaseId,
      appConfig.channelsCollectionId,
      ID.unique(),
      {
        type: channelInfo.type,
        name: channelInfo.name,
        youtubeChannelId: channelInfo.youtubeChannelId,
        thumbnailUrl: channelInfo.thumbnailUrl,
        description: channelInfo.description,
        ignoreDuration: channelInfo.ignoreDuration ?? false,
        includeShorts: channelInfo.includeShorts ?? true,
      }
    );

    return { success: true, channel };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add channel",
    };
  }
}

export async function updateChannel(
  youtubeChannelId: string,
  updates: Partial<ChannelInfo>
): Promise<AddChannelResult> {
  const { databases } = getAppwriteClient();

  try {
    const response = await databases.listDocuments(appConfig.databaseId, appConfig.channelsCollectionId, [
      Query.equal("youtubeChannelId", youtubeChannelId),
      Query.limit(1),
    ]);

    const document = response.documents[0];
    if (!document) {
      return { success: false, error: "Channel not found" };
    }

    const channel = await databases.updateDocument(
      appConfig.databaseId,
      appConfig.channelsCollectionId,
      document.$id,
      updates
    );

    return { success: true, channel };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update channel",
    };
  }
}

export async function deleteChannel(youtubeChannelId: string): Promise<DeleteChannelResult> {
  const { databases, storage } = getAppwriteClient();

  try {
    const channelResponse = await databases.listDocuments(
      appConfig.databaseId,
      appConfig.channelsCollectionId,
      [Query.equal("youtubeChannelId", youtubeChannelId), Query.limit(1)]
    );

    const channel = channelResponse.documents[0];
    if (!channel) {
      return { success: false, error: "Channel not found" };
    }

    let deletedVideos = 0;
    let deletedFiles = 0;

    while (true) {
      const videosResponse = await databases.listDocuments(
        appConfig.databaseId,
        appConfig.videosCollectionId,
        [Query.equal("channelId", youtubeChannelId), Query.limit(100)]
      );

      if (videosResponse.documents.length === 0) {
        break;
      }

      for (const video of videosResponse.documents) {
        if (video.videoId) {
          try {
            await storage.deleteFile(appConfig.storageBucketId, video.videoId);
            deletedFiles += 1;
          } catch {}
        }

        await databases.deleteDocument(appConfig.databaseId, appConfig.videosCollectionId, video.$id);
        deletedVideos += 1;
      }

      if (videosResponse.documents.length < 100) {
        break;
      }
    }

    await databases.deleteDocument(appConfig.databaseId, appConfig.channelsCollectionId, channel.$id);

    return { success: true, deletedVideos, deletedFiles };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete channel",
    };
  }
}

export async function cleanupOrphanedSpeeches() {
  const { databases, storage } = getAppwriteClient();
  const channels = await getAllChannels();
  const validChannelIds = new Set(channels.map((channel) => channel.youtubeChannelId));
  const allVideos: StoredVideo[] = [];
  let offset = 0;
  const limit = 5000;

  while (true) {
    const response = await databases.listDocuments(appConfig.databaseId, appConfig.videosCollectionId, [
      Query.limit(limit),
      Query.offset(offset),
    ]);

    allVideos.push(...(response.documents as unknown as StoredVideo[]));

    if (response.documents.length < limit) {
      break;
    }

    offset += limit;
  }

  const orphanedVideos = allVideos.filter((video) => !validChannelIds.has(video.channelId));
  const orphanedChannels = [...new Set(orphanedVideos.map((video) => video.channelId))];

  let deletedCount = 0;
  let deletedVideos = 0;

  for (const video of orphanedVideos) {
    if (video.videoId) {
      try {
        await storage.deleteFile(appConfig.storageBucketId, video.videoId);
        deletedVideos += 1;
      } catch {}
    }

    await databases.deleteDocument(appConfig.databaseId, appConfig.videosCollectionId, video.$id);
    deletedCount += 1;
  }

  const referencedFileIds = new Set(
    allVideos
      .filter((video) => video.videoId)
      .map((video) => video.videoId as string)
  );

  let deletedOrphanedStorageVideos = 0;
  let fileOffset = 0;
  const fileLimit = 100;

  while (true) {
    const response = await storage.listFiles(appConfig.storageBucketId, [
      Query.limit(fileLimit),
      Query.offset(fileOffset),
    ]);

    if (response.files.length === 0) {
      break;
    }

    for (const file of response.files) {
      if (!referencedFileIds.has(file.$id)) {
        try {
          await storage.deleteFile(appConfig.storageBucketId, file.$id);
          deletedOrphanedStorageVideos += 1;
        } catch {}
      }
    }

    if (response.files.length < fileLimit) {
      break;
    }

    fileOffset += fileLimit;
  }

  return {
    success: true,
    deletedCount,
    deletedVideos,
    deletedOrphanedStorageVideos,
    orphanedChannels,
  };
}
