import type { ChatMessage } from 'chatgpt'

export interface RequestOptions {
  message: string
  lastContext?: { conversationId?: string; parentMessageId?: string }
  onProgress?: (chat: ChatMessage) => void
  systemMessage?: string
  apiKey?: string
}
