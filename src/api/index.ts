import type { AxiosProgressEvent, GenericAbortSignal } from 'axios'
import { post } from '@/utils/request'
import { usePromptStore, useSettingStore } from '@/store'
import DefaultRoles from '@/assets/defaultRoles.json'
import { isNotEmptyString } from '@/utils/is'

interface RoleDescriptions {
  [key: string]: string
}
const defaultRolesList: RoleDescriptions = DefaultRoles

export function fetchChatConfig<T = any>() {
  const settingStore = useSettingStore()

  return post<T>({
    url: '/config',
    data: { apiKey: settingStore.apiEnKey },
  })
}

export function fetchChatAPIProcess<T = any>(
  params: {
    prompt: string
    role: string
    options?: { conversationId?: string; parentMessageId?: string }
    signal?: GenericAbortSignal
    onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void },
) {
  const settingStore = useSettingStore()
  let systemMessage = ''
  if (Object.prototype.hasOwnProperty.call(DefaultRoles, params.role))
    systemMessage = defaultRolesList[params.role]

  if (!isNotEmptyString(systemMessage)) {
    const promptStore = usePromptStore()
    const prompt = promptStore.getPromptByKey(params.role)
    if (prompt)
      systemMessage = prompt.value
  }
  if (!isNotEmptyString(systemMessage))
    systemMessage = defaultRolesList.chatgpt

  return post<T>({
    url: '/chat-process',
    data: { prompt: params.prompt, options: params.options, systemMessage, apiKey: settingStore.apiEnKey },
    signal: params.signal,
    onDownloadProgress: params.onDownloadProgress,
  })
}

export function fetchSession<T>() {
  return post<T>({
    url: '/session',
  })
}

export function fetchVerify<T>(token: string) {
  return post<T>({
    url: '/verify',
    data: { token },
  })
}
