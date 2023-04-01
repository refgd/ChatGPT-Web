import type { AxiosProgressEvent, GenericAbortSignal } from 'axios'
import { post } from '@/utils/request'
import { useAuthStoreWithout, usePromptStore, useSettingStore } from '@/store'
import { isEmptyString } from '@/utils/is'

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
  const authStore = useAuthStoreWithout()
  const defaultRoles = authStore.session?.roles

  let systemMessage = ''
  if (defaultRoles && defaultRoles.includes(params.role))
    systemMessage = params.role

  if (isEmptyString(systemMessage)) {
    const promptStore = usePromptStore()
    const prompt = promptStore.getPromptByKey(params.role)
    if (prompt)
      systemMessage = prompt.value
  }

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
