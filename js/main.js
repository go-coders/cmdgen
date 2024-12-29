import { CommandGenerator } from "./modules/command-generator.js"
import { UI } from "./modules/ui.js"
import { SettingsManager } from "./modules/settings.js"

// Initialize UI components
UI.initializeTextarea()

$(document).ready(() => {
  // Initialize settings button
  $("#settingsButton").on("click", () => {
    UI.showSettings()
  })

  // Initialize generate button
  $("#generateButton").on("click", () => {
    CommandGenerator.generate()
  })

  // Handle Enter key in textarea
  $("#questionInput").on("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      CommandGenerator.generate()
    }
  })

  // Auto-resize textarea
  $("#questionInput").on("input", function () {
    this.style.height = "auto"
    this.style.height = this.scrollHeight + "px"
  })

  // 初始化历史记录数量显示
  const settings = SettingsManager.get()
  $("#maxHistoryDisplay").text(settings.maxHistory)
})
