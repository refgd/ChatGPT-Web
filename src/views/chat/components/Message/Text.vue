<script lang="ts" setup>
import { computed, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import mdKatex from '@traptitech/markdown-it-katex'
import mila from 'markdown-it-link-attributes'
import hljs from 'highlight.js'
import { NButton } from 'naive-ui'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { t } from '@/locales'

interface Props {
  index?: number
  total?: number
  inversion?: boolean
  finish?: string | null
  error?: boolean
  text?: string
  loading?: boolean
  asRawText?: boolean
}

interface Emit {
  (ev: 'continue'): void
}

const props = defineProps<Props>()

const emit = defineEmits<Emit>()

const { isMobile } = useBasicLayout()

const textRef = ref<HTMLElement>()
const hasContinue = ref<boolean>(false)
function updateContinue(c: boolean) {
  hasContinue.value = c
}

const mdi = new MarkdownIt({
  linkify: true,
  highlight(code, language) {
    const validLang = !!(language && hljs.getLanguage(language))
    if (validLang) {
      const lang = language ?? ''
      return highlightBlock(hljs.highlight(code, { language: lang }).value, lang)
    }
    return highlightBlock(hljs.highlightAuto(code).value, '')
  },
})

function handleContinue() {
  emit('continue')
}

mdi.use(mila, { attrs: { target: '_blank', rel: 'noopener' } })
mdi.use(mdKatex, { blockClass: 'katexmath-block rounded-md p-[10px]', errorColor: ' #cc0000' })

const wrapClass = computed(() => {
  return [
    'text-wrap',
    'min-w-[20px]',
    'rounded-md',
    isMobile.value ? 'p-2' : 'px-3 py-2',
    props.inversion ? 'bg-[#d2f9d1]' : 'bg-[#f4f6f8]',
    props.inversion ? 'dark:bg-[#a1dc95]' : 'dark:bg-[#1e1e20]',
    props.inversion ? 'message-request' : 'message-reply',
    { 'text-red-500': props.error },
  ]
})

const text = computed(() => {
  const value = props.text ?? ''

  if (!props.asRawText) {
    let content = mdi.render(value + (props.loading ? '[[typing]]' : '')).replace('[[typing]]', '<span class="typing"></span>')
    let hasContinue = false
    if (props.finish === 'length') {
      if (props.total && props.index === props.total - 1)
        hasContinue = true
      else
        content += `[${t('chat.unfinish')}]`
    }

    updateContinue(hasContinue)
    return content
  }

  return value
})

function highlightBlock(str: string, lang?: string) {
  return `<pre class="code-block-wrapper"><div class="code-block-header"><span class="code-block-header__lang">${lang}</span><span class="code-block-header__copy">${t('chat.copyCode')}</span></div><code class="hljs code-block-body ${lang}">${str}</code></pre>`
}

defineExpose({ textRef })
</script>

<template>
  <div class="text-black" :class="wrapClass">
    <div ref="textRef" class="leading-relaxed break-words">
      <div v-if="!inversion">
        <div v-if="!asRawText" class="markdown-body" v-html="text" />
        <div v-else class="whitespace-pre-wrap" v-text="text" />

        <div v-if="hasContinue">
          <NButton block @click="handleContinue">
            {{ $t('chat.continue') }}
          </NButton>
        </div>
      </div>
      <div v-else class="whitespace-pre-wrap" v-text="text" />
    </div>
  </div>
</template>

<style lang="less">
@import url(./style.less);
</style>
