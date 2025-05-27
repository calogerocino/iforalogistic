export interface DiscordAttachment {
  id: string;
  url: string;
  proxyURL?: string;
  filename: string;
  contentType?: string | null;
  size: number;
  width?: number | null;
  height?: number | null;
}

export interface DiscordEmbedFooter {
  text: string;
  iconURL?: string;
}

export interface DiscordEmbedImage {
  url?: string;
  proxyURL?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedThumbnail {
  url?: string;
  proxyURL?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedVideo {
  url?: string;
  proxyURL?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedProvider {
  name?: string;
  url?: string;
}

export interface DiscordEmbedAuthor {
  name?: string;
  url?: string;
  iconURL?: string;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  timestamp?: string | null;
  color?: number | null;
  footer?: DiscordEmbedFooter | null;
  image?: DiscordEmbedImage | null;
  thumbnail?: DiscordEmbedThumbnail | null;
  video?: DiscordEmbedVideo | null;
  provider?: DiscordEmbedProvider | null;
  author?: DiscordEmbedAuthor | null;
  fields?: DiscordEmbedField[];
}

export interface DiscordMessage {
  driverName: any;
  distance: number;
  id: string;
  authorId: string;
  authorTag: string;
  authorAvatar?: string | null;
  content?: string;
  channelId: string;
  channelName?: string;
  timestamp: string;
  attachments?: DiscordAttachment[];
  embeds?: DiscordEmbed[];
  processedAt?: any;
}
