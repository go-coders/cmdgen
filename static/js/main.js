// Constants
const STORAGE_KEY = "linux_command_generator_settings"
const SETTINGS_DEFAULTS = {
  apiKey: "",
  baseUrl: "",
  model: "gpt-4o",
  temperature: 0.3,
  userPrompt: `You are a Linux command generator. Generate Linux commands based on the user's request.
Always respond with valid JSON in the following format:
{
  "suggestions": [
    {
      "command": "command1 | command2",
      "explanations": [
        {
          "name": "command1",
          "description": "第一个命令的作用",
          "parameters": [
            {
              "flag": "-flag",
              "description": "参数的解释"
            }
          ]
        },
        {
          "name": "command2",
          "description": "第二个命令的作用",
          "parameters": [
            {
              "flag": "-flag",
              "description": "参数的解释"
            }
          ]
        }
      ],
      "isPrimary": true
    }
  ]
}

Important instructions:
1. For the input: {question}
2. Use Chinese responses to explain
3. Keep command syntax in standard Linux format regardless of language
4. For compound commands (using pipes):
   - Each command in the pipeline should have its own explanation in the explanations array
   - Include all parameters and their explanations for each command
   - Mark the most appropriate command as primary
5. Each suggestion must be a complete, executable command
6. Only return valid JSON`,
}

// Settings Management
const SettingsManager = {
  get() {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
    return { ...SETTINGS_DEFAULTS, ...stored }
  },

  load() {
    const settings = this.get()
    $("#apiKey").val(settings.apiKey || "")
    $("#baseUrl").val(settings.baseUrl || SETTINGS_DEFAULTS.baseUrl)
    $("#model").val(settings.model || SETTINGS_DEFAULTS.model)
    $("#temperature").val(settings.temperature || SETTINGS_DEFAULTS.temperature)
    $("#userPrompt").val(settings.userPrompt || SETTINGS_DEFAULTS.userPrompt)
  },

  save() {
    let apiKey = $("#apiKey").val().trim()
    let baseUrl = $("#baseUrl").val().trim()
    let temperature = parseFloat($("#temperature").val())

    // Validate temperature
    if (isNaN(temperature) || temperature < 0 || temperature > 2) {
      temperature = SETTINGS_DEFAULTS.temperature
    }

    const settings = {
      apiKey,
      baseUrl,
      model: $("#model").val().trim(),
      temperature,
      userPrompt: $("#userPrompt").val().trim(),
    }

    console.log("Saving settings:", {
      apiKey: settings.apiKey ? "..." + settings.apiKey.slice(-10) : "not set",
      baseUrl: settings.baseUrl,
      model: settings.model,
      temperature: settings.temperature,
    })

    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  },

  reset() {
    $("#userPrompt").val(SETTINGS_DEFAULTS.userPrompt)
  },

  isConfigured() {
    const settings = this.get()
    return settings.apiKey && settings.apiKey.trim() !== ""
  },
}

// UI Components
const UI = {
  initializeTextarea() {
    const $textarea = $("#questionInput")

    function adjustHeight() {
      $textarea.css("height", "auto").css("height", Math.max(40, $textarea[0].scrollHeight) + "px")
    }

    $textarea
      .on("input", adjustHeight)
      .on("keypress", function (e) {
        if (e.key === "Enter") {
          e.preventDefault()
          CommandGenerator.generate()
        }
      })
      .on("paste", function (e) {
        e.preventDefault()
        const text = (e.originalEvent.clipboardData || window.clipboardData).getData("text")
        const cleanText = text.replace(/[\r\n]/g, " ")
        const start = this.selectionStart
        const end = this.selectionEnd
        const currentValue = $(this).val()
        const newValue = currentValue.substring(0, start) + cleanText + currentValue.substring(end)
        $(this).val(newValue)
        this.setSelectionRange(start + cleanText.length, start + cleanText.length)
        adjustHeight()
      })

    $textarea.css("height", "40px")
    adjustHeight()
  },

  showSettings() {
    $(".settings-modal").addClass("show")
  },

  hideSettings() {
    $(".settings-modal").removeClass("show")
  },

  renderCommandExplanation(explanations, command) {
    return explanations
      .map((explanation, index) => {
        const html = `
          <div class="command-group">
            <div class="command-name">${explanation.name}</div>
            <div class="command-desc">${explanation.description}</div>
            <div class="param-list">
              ${explanation.parameters
                .map(
                  (param) => `
                  <div class="param-item">
                    <span class="param-flag">${param.flag}</span>
                    <span class="param-desc">${param.description}</span>
                  </div>
                `
                )
                .join("")}
            </div>
          </div>
        `
        return index === explanations.length - 1 ? html : html + '<div class="pipeline-separator">|</div>'
      })
      .join("")
  },
}

// Command Generation
const CommandGenerator = {
  async generate() {
    const $questionInput = $("#questionInput")
    const $result = $("#result")
    const question = $questionInput.val().trim()

    if (!question) return
    if (!SettingsManager.isConfigured()) {
      UI.showSettings()
      return
    }

    const settings = SettingsManager.get()
    $result.html("<div style='text-align: center; color: #666;'>生成命令中...</div>").show()

    try {
      const response = await this.fetchCommand(question)
      const suggestions = this.parseResponse(response)
      this.displayResults(suggestions)
    } catch (error) {
      $result.html(`<div class="error">Error: ${error.message || "Could not generate command"}</div>`)
    }
  },

  async fetchCommand(question) {
    const settings = SettingsManager.get()
    const requestBody = {
      model: settings.model,
      temperature: settings.temperature,
      messages: [
        {
          role: "user",
          content: settings.userPrompt.replace("{question}", question),
        },
      ],
    }

    const response = await fetch(settings.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()
    if (data.error) {
      throw new Error(data.error.message || data.error)
    }

    return data
  },

  parseResponse(data) {
    let content = data.choices[0].message.content
    console.log("API Response:", content)
    content = content.replace(/^```json\n/, "").replace(/\n```$/, "")

    const result = JSON.parse(content)

    // Validate response format
    if (!result.suggestions || !Array.isArray(result.suggestions)) {
      throw new Error("Invalid response format: missing suggestions array")
    }

    result.suggestions.forEach((suggestion, index) => {
      if (!suggestion.explanations || !Array.isArray(suggestion.explanations)) {
        throw new Error(`Invalid suggestion format at index ${index}: missing explanations array`)
      }
      suggestion.explanations.forEach((explanation, expIndex) => {
        if (!explanation.parameters || !Array.isArray(explanation.parameters)) {
          throw new Error(`Invalid explanation format at suggestion ${index}, explanation ${expIndex}: missing parameters array`)
        }
      })
    })

    return result
  },

  displayResults(result) {
    const $result = $("#result")
    const suggestionsHtml = result.suggestions
      .map(
        (suggestion) => `
        <div class="suggestion">
          <div class="command-container">
            <div class="command">${suggestion.command}</div>
            <button class="copy-button" onclick="copyToClipboard('${suggestion.command.replace(/'/g, "\\'")}', this)" title="Copy to clipboard">
              <svg class="copy-icon" viewBox="0 0 16 16" fill="currentColor">
                <path fill-rule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                <path fill-rule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
              </svg>
              Copy
            </button>
          </div>
          <div class="explanation-section">
            ${UI.renderCommandExplanation(suggestion.explanations, suggestion.command)}
          </div>
        </div>
      `
      )
      .join("")

    $result.html(`${suggestionsHtml}`)
  },
}

// Clipboard functionality
function copyToClipboard(text, button) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const $button = $(button)
      $button.addClass("copied").html(`
        <svg class="copy-icon" viewBox="0 0 16 16" fill="currentColor">
          <path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
        </svg>
        Copied
      `)

      setTimeout(() => {
        $button.removeClass("copied").html(`
          <svg class="copy-icon" viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
            <path fill-rule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
          </svg>
          Copy
        `)
      }, 2000)
    })
    .catch((err) => {
      console.error("Failed to copy text:", err)
    })
}

// Initialize
function initApp() {
  SettingsManager.load()
  UI.initializeTextarea()

  // Settings modal handlers
  $("#settingsButton").on("click", UI.showSettings)
  $(".settings-modal").on("click", function (e) {
    if (e.target === this) {
      UI.hideSettings()
    }
  })

  // Settings buttons handlers
  $(".save-button").on("click", () => {
    SettingsManager.save()
    UI.hideSettings()
  })
  $(".cancel-button").on("click", UI.hideSettings)
  $(".reset-button").on("click", SettingsManager.reset)
}

// Wait for DOM and dependencies to load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    if (typeof jQuery === "undefined") {
      console.error("jQuery is required but not loaded!")
      return
    }
    initApp()
  })
} else {
  if (typeof jQuery === "undefined") {
    console.error("jQuery is required but not loaded!")
  } else {
    initApp()
  }
}
