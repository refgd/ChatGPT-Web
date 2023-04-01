import { defineStore } from 'pinia'
import type { SettingsState } from './helper'
import { defaultSetting, getLocalState, removeLocalState, setLocalState } from './helper'
import { isEmptyString } from '@/utils/is'
import { enCrypto } from '@/utils/crypto'

export const useSettingStore = defineStore('setting-store', {
  state: (): SettingsState => getLocalState(),
  actions: {
    updateSetting(settings: Partial<SettingsState>) {
      if (Object.prototype.hasOwnProperty.call(settings, 'apiKey')) {
        if (!isEmptyString(settings.apiKey)) {
          if (settings.apiKey?.slice(0, 6) === 'sk-***')
            return

          settings.apiEnKey = enCrypto(settings.apiKey)
          settings.apiKey = `sk-***${settings.apiKey?.slice(-4)}`
        }
        else {
          settings.apiEnKey = ''
          settings.apiKey = ''
        }
      }
      this.$state = { ...this.$state, ...settings }
      this.recordState()
    },

    resetSetting() {
      this.$state = defaultSetting()
      removeLocalState()
    },

    recordState() {
      setLocalState(this.$state)
    },
  },
})
