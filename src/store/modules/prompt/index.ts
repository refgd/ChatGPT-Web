import { defineStore } from 'pinia'
import type { PromptStore } from './helper'
import { getLocalPromptList, setLocalPromptList } from './helper'

export const usePromptStore = defineStore('prompt-store', {
  state: (): PromptStore => getLocalPromptList(),

  getters: {
    getPromptByKey(state: PromptStore) {
      return (key?: string) => {
        const prompt: { key: string; value: string }[] = state.promptList.filter((item: { key: string; value: string }) => item.key === key)
        if (prompt.length > 0)
          return prompt[0]

        return undefined
      }
    },
  },

  actions: {
    updatePromptList(promptList: []) {
      this.$patch({ promptList })
      setLocalPromptList({ promptList })
    },
    getPromptList() {
      return this.$state
    },
  },
})
