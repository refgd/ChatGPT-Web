import type { ChatMessage } from 'chatgpt'
import type { MTimeout } from '../utils/timeout'

export interface RequestOptions {
  message: string
  lastContext?: { conversationId?: string; parentMessageId?: string }
  onProgress?: (chat: ChatMessage, timeoutHandle?: MTimeout) => void
  systemMessage?: string
  apiKey?: string
}
