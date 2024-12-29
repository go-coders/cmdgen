import { SETTINGS_DEFAULTS } from "./constants.js"

export const SettingsManager = {
  settings: null,

  get() {
    if (!this.settings) {
      this.load()
    }
    return this.settings
  },

  load() {
    const savedSettings = localStorage.getItem("settings")
    if (savedSettings) {
      try {
        this.settings = JSON.parse(savedSettings)
      } catch (e) {
        console.error("Failed to parse saved settings:", e)
        this.settings = { ...SETTINGS_DEFAULTS }
      }
    } else {
      this.settings = { ...SETTINGS_DEFAULTS }
    }
  },

  save(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings,
    }
    localStorage.setItem("settings", JSON.stringify(this.settings))
    // 更新历史记录显示
    $("#maxHistoryDisplay").text(this.settings.maxHistory)
  },

  reset() {
    this.settings = { ...SETTINGS_DEFAULTS }
    localStorage.setItem("settings", JSON.stringify(this.settings))
    // 更新历史记录显示
    $("#maxHistoryDisplay").text(SETTINGS_DEFAULTS.maxHistory)
  },

  isConfigured() {
    return this.get().apiKey && this.get().apiKey.length > 0
  },
}
