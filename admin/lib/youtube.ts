export interface YouTubeSourceInfo {
  type: "channel" | "playlist";
  youtubeChannelId: string;
  name: string;
  thumbnailUrl: string;
  description: string;
  subscriberCount?: number;
  videoCount: number;
}

const BASE_URL = "https://www.googleapis.com/youtube/v3";

export async function fetchChannelInfo(
  channelId: string,
  apiKey: string
): Promise<YouTubeSourceInfo> {
  const response = await fetch(
    `${BASE_URL}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const channel = data.items?.[0];

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  return {
    type: "channel",
    youtubeChannelId: channelId,
    name: channel.snippet.title,
    thumbnailUrl:
      channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url || "",
    description: channel.snippet.description || "",
    subscriberCount: parseInt(channel.statistics?.subscriberCount || "0", 10),
    videoCount: parseInt(channel.statistics?.videoCount || "0", 10),
  };
}

export async function fetchPlaylistInfo(
  playlistId: string,
  apiKey: string
): Promise<YouTubeSourceInfo> {
  const response = await fetch(
    `${BASE_URL}/playlists?part=snippet,contentDetails&id=${playlistId}&key=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const playlist = data.items?.[0];

  if (!playlist) {
    throw new Error(`Playlist not found: ${playlistId}`);
  }

  return {
    type: "playlist",
    youtubeChannelId: playlistId,
    name: playlist.snippet.title,
    thumbnailUrl:
      playlist.snippet.thumbnails.high?.url || playlist.snippet.thumbnails.default?.url || "",
    description: playlist.snippet.description || "",
    videoCount: parseInt(playlist.contentDetails?.itemCount || "0", 10),
  };
}
