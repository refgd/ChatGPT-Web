import * as dotenv from 'dotenv'
import 'isomorphic-fetch'
import type { ChatGPTAPIOptions, ChatMessage, SendMessageOptions } from 'chatgpt'
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from 'chatgpt'
import { SocksProxyAgent } from 'socks-proxy-agent'
import httpsProxyAgent from 'https-proxy-agent'
import fetch from 'node-fetch'
import axios from 'axios'
import { sendResponse } from '../utils'
import { isEmptyString } from '../utils/is'
import { deCrypto } from '../utils/crypto'
import { getSysMessageByKey } from '../utils/prompts'
import { MTimeout } from '../utils/timeout'

import type { ApiModel, ChatContext, ChatGPTUnofficialProxyAPIOptions, ModelConfig } from '../types'
import type { RequestOptions } from './types'

const { HttpsProxyAgent } = httpsProxyAgent

dotenv.config()

const ErrorCodeMessage: Record<string, string> = {
  401: '[OpenAI] 提供错误的API密钥 | Incorrect API key provided',
  403: '[OpenAI] 服务器拒绝访问，请稍后再试 | Server refused to access, please try again later',
  502: '[OpenAI] 错误的网关 |  Bad Gateway',
  503: '[OpenAI] 服务器繁忙，请稍后再试 | Server is busy, please try again later',
  504: '[OpenAI] 网关超时 | Gateway Time-out',
  500: '[OpenAI] 服务器繁忙，请稍后再试 | Internal Server Error',
}

const timeoutMs: number = !isNaN(+process.env.TIMEOUT_MS) ? +process.env.TIMEOUT_MS : 30 * 1000
const disableDebug: boolean = process.env.OPENAI_API_DISABLE_DEBUG === 'true'

let apiModel: ApiModel

if (isEmptyString(process.env.OPENAI_API_KEY) && isEmptyString(process.env.OPENAI_ACCESS_TOKEN))
  throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable')

let api: ChatGPTAPI | ChatGPTUnofficialProxyAPI

(async () => {
  // More Info: https://github.com/transitive-bullshit/chatgpt-api

  if (!isEmptyString(process.env.OPENAI_API_KEY)) {
    const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL
    const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL
    const model = !isEmptyString(OPENAI_API_MODEL) ? OPENAI_API_MODEL : 'gpt-3.5-turbo'

    const options: ChatGPTAPIOptions = {
      apiKey: process.env.OPENAI_API_KEY,
      completionParams: { model },
      debug: !disableDebug,
    }

    // increase max token limit if use gpt-4
    if (model.toLowerCase().includes('gpt-4')) {
      // if use 32k model
      if (model.toLowerCase().includes('32k')) {
        options.maxModelTokens = 32768
        options.maxResponseTokens = 8192
      }
      else {
        options.maxModelTokens = 8192
        options.maxResponseTokens = 2048
      }
    }

    if (!isEmptyString(OPENAI_API_BASE_URL))
      options.apiBaseUrl = `${OPENAI_API_BASE_URL}/v1`

    setupProxy(options)

    api = new ChatGPTAPI({ ...options })
    apiModel = 'ChatGPTAPI'
  }
  else {
    const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL
    const options: ChatGPTUnofficialProxyAPIOptions = {
      accessToken: process.env.OPENAI_ACCESS_TOKEN,
      debug: !disableDebug,
    }
    if (!isEmptyString(OPENAI_API_MODEL))
      options.model = OPENAI_API_MODEL

    if (!isEmptyString(process.env.API_REVERSE_PROXY))
      options.apiReverseProxyUrl = process.env.API_REVERSE_PROXY

    setupProxy(options)

    api = new ChatGPTUnofficialProxyAPI({ ...options })
    apiModel = 'ChatGPTUnofficialProxyAPI'
  }
})()

async function chatReplyProcess(options: RequestOptions) {
  const { message, lastContext, onProgress, systemMessage, apiKey } = options
  let timeoutHandle: MTimeout

  try {
    let options: SendMessageOptions = { }

    if (api instanceof ChatGPTAPI) {
      let sysMessage = ''
      if (!isEmptyString(systemMessage)) {
        sysMessage = getSysMessageByKey(systemMessage)
        if (isEmptyString(sysMessage))
          sysMessage = systemMessage
      }
      else { sysMessage = getSysMessageByKey('chatgpt') }

      const currentDate = new Date().toISOString().split('T')[0]
      options.systemMessage = `${sysMessage}\nCurrent date: ${currentDate}`

      if (!isEmptyString(apiKey))
        api.apiKey = deCrypto(apiKey)
      else
        api.apiKey = process.env.OPENAI_API_KEY
    }

    if (lastContext != null) {
      if (apiModel === 'ChatGPTAPI')
        options.parentMessageId = lastContext.parentMessageId

      else
        options = { ...lastContext }
    }

    if (timeoutMs) {
      const controller = new AbortController()
      options.abortSignal = controller.signal

      timeoutHandle = new MTimeout(timeoutMs)
      timeoutHandle.onTimeout = () => {
        controller.abort()
      }
    }

    const response = await api.sendMessage(message, {
      ...options,
      onProgress: (partialResponse) => {
        onProgress?.(partialResponse, timeoutHandle)
      },
    })

    if (timeoutHandle)
      timeoutHandle.cancel()
    timeoutHandle = undefined

    return sendResponse({ type: 'Success', data: response })
  }
  catch (error: any) {
    if (timeoutHandle)
      timeoutHandle.cancel()
    timeoutHandle = undefined

    const code = error.statusCode
    global.console.log(error)
    if (Reflect.has(ErrorCodeMessage, code))
      return sendResponse({ type: 'Fail', message: ErrorCodeMessage[code] })
    return sendResponse({ type: 'Fail', message: error.message ?? 'Please check the back-end console' })
  }
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  return `${year}-${month}-${day}`
}

async function fetchBalance(apiKey: string) {
  const OPENAI_API_KEY = !isEmptyString(apiKey) ? deCrypto(apiKey) : process.env.OPENAI_API_KEY
  const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL

  if (isEmptyString(OPENAI_API_KEY))
    return Promise.resolve('-')

  const API_BASE_URL = !isEmptyString(OPENAI_API_BASE_URL)
    ? OPENAI_API_BASE_URL
    : 'https://api.openai.com'

  try {
    const now = new Date().getTime()
    const startDate = new Date(now - 90 * 24 * 60 * 60 * 1000)
    const endDate = new Date(now + 24 * 60 * 60 * 1000)

    const urlSubscription = `${API_BASE_URL}/v1/dashboard/billing/subscription`
    const urlUsage = `${API_BASE_URL}/v1/dashboard/billing/usage?start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}`
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` }

    // 获取API限额
    let response = await axios.get(urlSubscription, { headers })
    const totalAmount = response.data.hard_limit_usd

    // 获取已使用量
    response = await axios.get(urlUsage, { headers })
    const totalUsage = response.data.total_usage / 100

    // 计算剩余额度
    const remaining = totalAmount - totalUsage

    return Promise.resolve(remaining.toFixed(3))
  }
  catch {
    return Promise.resolve('-')
  }
}

async function chatConfig(apiKey: string) {
  const balance = await fetchBalance(apiKey)
  const reverseProxy = process.env.API_REVERSE_PROXY ?? '-'
  const httpsProxy = (process.env.HTTPS_PROXY || process.env.ALL_PROXY) ?? '-'
  const socksProxy = (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT)
    ? (`${process.env.SOCKS_PROXY_HOST}:${process.env.SOCKS_PROXY_PORT}`)
    : '-'
  return sendResponse<ModelConfig>({
    type: 'Success',
    data: { apiModel, reverseProxy, timeoutMs, socksProxy, httpsProxy, balance },
  })
}

function setupProxy(options: ChatGPTAPIOptions | ChatGPTUnofficialProxyAPIOptions) {
  if (!isEmptyString(process.env.SOCKS_PROXY_HOST) && !isEmptyString(process.env.SOCKS_PROXY_PORT)) {
    const agent = new SocksProxyAgent({
      hostname: process.env.SOCKS_PROXY_HOST,
      port: process.env.SOCKS_PROXY_PORT,
      userId: !isEmptyString(process.env.SOCKS_PROXY_USERNAME) ? process.env.SOCKS_PROXY_USERNAME : undefined,
      password: !isEmptyString(process.env.SOCKS_PROXY_PASSWORD) ? process.env.SOCKS_PROXY_PASSWORD : undefined,
    })
    options.fetch = (url, options) => {
      return fetch(url, { agent, ...options })
    }
  }
  else {
    if (!isEmptyString(process.env.HTTPS_PROXY) || !isEmptyString(process.env.ALL_PROXY)) {
      const httpsProxy = process.env.HTTPS_PROXY || process.env.ALL_PROXY
      if (httpsProxy) {
        const agent = new HttpsProxyAgent(httpsProxy)
        options.fetch = (url, options) => {
          return fetch(url, { agent, ...options })
        }
      }
    }
  }
}

function currentModel(): ApiModel {
  return apiModel
}

export type { ChatContext, ChatMessage }

export { chatReplyProcess, chatConfig, currentModel }
