export interface DiscordMessage {
  id?: string;
  authorId: string;
  authorTag: string;
  authorAvatar?: string;
  content: string;
  channelId: string;
  channelName: string;
  messageId: string;
  discordTimestamp: string; // Original Discord timestamp (ISO string)
  savedAt?: any; // Firestore server timestamp
}
