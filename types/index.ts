export interface Speech {
  $id: string;
  title: string;
  youtubeId: string;
  videoId: string;
  thumbnailUrl: string;
  duration: number;
  uploadDate: string;
  channelName: string;
  channelId: string;
  views: number;
  description?: string;
  tags?: string[];
  language?: string;
  topic?: string;
  isShort?: boolean;
}

export interface Channel {
  $id: string;
  name: string;
  youtubeChannelId: string;
  thumbnailUrl?: string;
  description?: string;
  type: "channel" | "playlist";
  ignoreDuration?: boolean;
  includeShorts?: boolean;
  isKidsChannel?: boolean;
}
