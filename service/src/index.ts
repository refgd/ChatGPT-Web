import express from 'express'
import compression from 'compression'
import type { RequestConfigProps, RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isEmptyString } from './utils/is'
import { getRolesKey } from './utils/prompts'
import type { MTimeout } from './utils/timeout'

const app = express()
const router = express.Router()

app.use(compression({ level: 6 }))
app.use(express.static('public'))
app.use(express.json())

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  let firstChunk = true
  let tHandle

  try {
    req.on('close', () => {
      if (tHandle)
        tHandle.timeOut()
    }).on('aborted', () => {
      if (tHandle)
        tHandle.timeOut()
    })

    res.on('close', () => {
      if (tHandle)
        tHandle.timeOut()
    }).on('aborted', () => {
      if (tHandle)
        tHandle.timeOut()
    })

    const { prompt, options = {}, systemMessage, apiKey } = req.body as RequestProps
    await chatReplyProcess({
      message: prompt,
      lastContext: options,
      onProgress: (chat: ChatMessage, timeoutHandle?: MTimeout) => {
        if (timeoutHandle) {
          tHandle = timeoutHandle
          timeoutHandle.reset()
        }
        res.write((firstChunk ? '' : '\n') + JSON.stringify(chat))
        firstChunk = false
        res.flush()
      },
      systemMessage,
      apiKey,
    })
  }
  catch (error) {
    res.write((firstChunk ? '' : '\n') + JSON.stringify({ role: 'assistant', error: JSON.stringify(error), choices: [{ delta: {}, index: 0, finish_reason: 'error' }] }))
  }
  finally {
    tHandle = undefined
    res.end()
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const { apiKey } = req.body as RequestConfigProps
    const response = await chatConfig(apiKey)
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = !isEmptyString(AUTH_SECRET_KEY)
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel(), roles: getRolesKey() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
