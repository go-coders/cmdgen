import { SettingsManager } from "./settings.js"
import { UI } from "./ui.js"
import { copyToClipboard } from "./clipboard.js"
import { SETTINGS_DEFAULTS, DEBUG_MODE } from "./constants.js"

// 添加日志工具函数
const logger = {
  log: (...args) => DEBUG_MODE && console.log(...args),
  debug: (...args) => DEBUG_MODE && console.debug(...args),
  error: (...args) => console.error(...args), // 错误总是输出
}

export const CommandGenerator = {
  // Store conversation context
  context: {
    history: [], // Store conversation history
  },

  // Add request lock
  isGenerating: false,

  handleFollowUp() {
    const question = $("#questionInput").val().trim()
    if (question && !this.isGenerating) {
      this.generate()
    } else {
      $("#questionInput").focus()
      $("#questionInput").attr("placeholder", "请输入你的追问...")
    }
  },

  handleNewTopic() {
    const $questionInput = $("#questionInput")
    const question = $questionInput.val().trim()

    // Clear history and result container
    this.context.history = []
    $("#result").html("").hide()

    // If there's content in the input, generate response
    if (question) {
      this.generate()
      return
    }

    // Clear the input and focus
    $questionInput.val("").focus()
    $questionInput.attr("placeholder", "描述你想要执行的操作...")
    $questionInput.css("height", "40px") // Reset height to initial value

    // Reset buttons to initial state
    this.resetButtons()
  },

  resetButtons() {
    $(".button-container").html(`
      <button id="generateButton" class="inline-flex items-center justify-center h-10 px-6 font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:ring-4 focus:ring-blue-100 transition-colors">
        <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        查询
      </button>
    `)
    $("#generateButton").on("click", () => this.generate())
  },

  showActionButtons() {
    $(".button-container").html(`
      <div class="flex justify-center gap-4">
        <button id="followUpButton" class="inline-flex items-center justify-center h-10 px-6 font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 focus:ring-4 focus:ring-teal-100 transition-colors">
          <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          继续提问
        </button>
        <button id="newTopicButton" class="inline-flex items-center justify-center h-10 px-6 font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-colors">
          <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          新问题
        </button>
      </div>
    `)
    $("#followUpButton").on("click", () => this.handleFollowUp())
    $("#newTopicButton").on("click", () => this.handleNewTopic())
  },

  async generate() {
    // Prevent multiple requests
    if (this.isGenerating) {
      return
    }

    const $questionInput = $("#questionInput")
    const $result = $("#result")
    const question = $questionInput.val().trim()

    if (!question) return
    if (!SettingsManager.isConfigured()) {
      UI.showSettings()
      return
    }

    // Set request lock and disable buttons
    this.isGenerating = true
    this.disableButtons()

    // Add loading animation at the top
    const loadingHtml = `
      <div id="loadingAnimation" class="flex items-center justify-center my-8">
        <div class="relative">
          <!-- 外圈动画 -->
          <div class="w-12 h-12 rounded-full border-4 border-blue-100 animate-[spin_3s_linear_infinite]"></div>
          <!-- 内圈动画 -->
          <div class="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-t-blue-500 animate-[spin_1s_linear_infinite]"></div>
          <!-- 中心点 -->
          <div class="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        </div>
        <span class="ml-4 text-gray-600">生成请求中...</span>
      </div>
    `

    // Insert loading animation before result container
    $("#result").before(loadingHtml)

    try {
      const response = await this.fetchCommand(question)
      const result = this.parseResponse(response)

      // Remove loading animation
      $("#loadingAnimation").remove()

      // Clear input and update placeholder
      $questionInput.val("")
      $questionInput.attr("placeholder", "继续输入问题...")
      $questionInput.css("height", "40px") // Reset height to initial value

      // Display question and result
      this.displayResults(result, question)

      // Show result container after content is added
      $result.show()

      // Show action buttons
      this.showActionButtons()
    } catch (error) {
      // Remove loading animation
      $("#loadingAnimation").remove()

      // Show error message at the top of results
      $result
        .html(
          `
        <div class="bg-red-50 p-4 rounded-lg text-red-600">
          <p class="font-medium">Error: ${error.message || "Could not generate command"}</p>
          ${error.message.includes("parsing") ? `<pre class="mt-2 text-sm overflow-auto">${content}</pre>` : ""}
        </div>
      `
        )
        .show()
    } finally {
      // Reset request lock and enable buttons
      this.isGenerating = false
      this.enableButtons()
    }
  },

  async fetchCommand(question) {
    const settings = SettingsManager.get()

    // Start with system message
    const messages = [
      {
        role: "system",
        content: settings.userPrompt,
      },
    ]

    // Flatten history into individual messages
    const flatHistory = []
    // Reverse history to get chronological order
    const reversedHistory = [...this.context.history].reverse()

    // Add messages in chronological order
    reversedHistory.forEach((item) => {
      flatHistory.push(
        {
          role: "user",
          content: item.question,
        },
        {
          role: "assistant",
          content: item.rawResponse,
        }
      )
    })

    // Get the most recent N-2 messages (maxHistory - 2 to account for system message and current question)
    const recentMessages = flatHistory.slice(-(settings.maxHistory - 2))

    // Add recent messages
    messages.push(...recentMessages)

    // Add current question last
    messages.push({
      role: "user",
      content: question,
    })

    const requestBody = {
      model: settings.model,
      temperature: settings.temperature,
      messages: messages,
    }

    logger.log("Sending request with messages:", messages)

    const response = await fetch(settings.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey.trim()}`,
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
    logger.log("Raw API Response:", content)

    // Clean the response content
    content = content
      .replace(/^[\s\n]*```json[\s\n]*/, "")
      .replace(/[\s\n]*```[\s\n]*$/, "")
      .replace(/<[^>]*>/g, "")
      .trim()

    try {
      // Log the content before parsing
      logger.debug("Attempting to parse JSON:", {
        contentLength: content.length,
        contentPreview: content.substring(0, 200) + (content.length > 200 ? "..." : ""),
        fullContent: content,
      })

      const result = JSON.parse(content)

      // Log the parsed result
      logger.debug("Successfully parsed JSON:", {
        type: result.type,
        structure: JSON.stringify(result, null, 2),
      })

      // Validate response format based on type
      if (!result.type) {
        throw new Error("Invalid response format: missing type field")
      }

      if (result.type === "command") {
        // Validate command type response
        if (!result.suggestions || !Array.isArray(result.suggestions)) {
          throw new Error("Invalid command response: missing suggestions array")
        }

        result.suggestions.forEach((suggestion, index) => {
          if (!suggestion.explanations || !Array.isArray(suggestion.explanations)) {
            throw new Error(`Invalid suggestion format at index ${index}: missing explanations array`)
          }
          suggestion.explanations.forEach((explanation, expIndex) => {
            // Make parameters array optional
            if (explanation.parameters && !Array.isArray(explanation.parameters)) {
              throw new Error(`Invalid explanation format at suggestion ${index}, explanation ${expIndex}: parameters must be an array`)
            }
            // Add empty parameters array if not present
            if (!explanation.parameters) {
              explanation.parameters = []
            }
          })
        })
      } else if (result.type === "explanation") {
        // Validate explanation type response
        if (!result.content) {
          throw new Error("Invalid explanation response: missing content")
        }
        if (!Array.isArray(result.content.sections)) {
          throw new Error("Invalid explanation response: sections must be an array")
        }
        if (result.content.sections.length === 0) {
          throw new Error("Invalid explanation response: sections array is empty")
        }
        // Validate each section
        result.content.sections.forEach((section, index) => {
          if (!section.type) {
            throw new Error(`Invalid section at index ${index}: missing type`)
          }
          switch (section.type) {
            case "text":
              if (!section.content) {
                throw new Error(`Invalid text section at index ${index}: missing content`)
              }
              break
            case "code":
              if (!section.content) {
                throw new Error(`Invalid code section at index ${index}: missing content`)
              }
              break
            case "list":
              if (!Array.isArray(section.items)) {
                throw new Error(`Invalid list section at index ${index}: items must be an array`)
              }
              break
            default:
              throw new Error(`Invalid section type at index ${index}: ${section.type}`)
          }
        })
        // Related is optional but must be an array if present
        if (result.content.related && !Array.isArray(result.content.related)) {
          throw new Error("Invalid explanation response: related must be an array")
        }
      } else {
        throw new Error(`Invalid response type: ${result.type}`)
      }

      return result
    } catch (error) {
      logger.debug("Response parsing failed:", {
        error: error.message,
        errorType: error.constructor.name,
        errorStack: error.stack,
        content: content,
      })

      // If not valid JSON, return as text explanation
      return {
        type: "explanation",
        content: {
          sections: [
            {
              type: "text",
              content: content,
            },
          ],
        },
      }
    }
  },

  displayResults(result, question) {
    const $result = $("#result")

    // Remove loading message
    $(".loading-message").remove()

    // Create current conversation item
    let currentHtml = `
      <div class="conversation-item mb-6">
        <div class="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600 mb-4">
          <div class="text-gray-800 text-[15px] font-medium">${question}</div>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          ${
            result.type === "command"
              ? result.suggestions
                  .map(
                    (suggestion) => `
              <div class="mb-6 last:mb-0">
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 flex items-start justify-between gap-3">
                  <code class="font-mono text-sm text-gray-800 flex-1 whitespace-pre-wrap break-all">${suggestion.command}</code>
                  <button class="copy-button flex-shrink-0 flex items-center gap-2 px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded text-sm" data-command="${encodeURIComponent(
                    suggestion.command
                  )}">
                    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                      <path fill-rule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                      <path fill-rule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
                    </svg>
                    复制
                  </button>
                </div>
                <div class="mt-3 text-gray-700">
                  ${UI.renderCommandExplanation(suggestion.explanations, suggestion.command)}
                </div>
                ${
                  suggestion.notes
                    ? `
                  <div class="mt-3 bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                    <span class="font-medium">注意事项：</span>${suggestion.notes}
                  </div>
                `
                    : ""
                }
              </div>
            `
                  )
                  .join("")
              : `<div class="prose max-w-none">
              ${result.content.sections
                .map((section) => {
                  switch (section.type) {
                    case "text":
                      return `<p class="text-gray-700">${section.content}</p>`
                    case "code":
                      return `
                      <div class="bg-gray-50 rounded-lg p-4 my-3">
                        <code class="font-mono text-sm text-gray-800 whitespace-pre-wrap break-all">${section.content}</code>
                        ${section.description ? `<div class="mt-2 text-sm text-gray-600">${section.description}</div>` : ""}
                      </div>`
                    case "list":
                      return `
                      <ul class="list-disc pl-5 space-y-2">
                        ${section.items.map((item) => `<li class="text-gray-700">${item}</li>`).join("")}
                      </ul>`
                    default:
                      return ""
                  }
                })
                .join("")}
              ${
                result.content.notes
                  ? `
                <div class="mt-4 bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                  <span class="font-medium">注意事项：</span>${result.content.notes}
                </div>
              `
                  : ""
              }
            </div>`
          }
        </div>
      </div>
    `

    // Add current conversation to history at the beginning
    this.context.history.unshift({
      question,
      result: currentHtml,
      rawResponse: JSON.stringify(result),
    })

    // Prepend new conversation
    $result.prepend(currentHtml)

    // Add click handlers for copy buttons
    $(".copy-button").on("click", function () {
      const command = decodeURIComponent($(this).data("command"))
      copyToClipboard(command, this)
    })
  },

  // Add button state control methods
  disableButtons() {
    $("#generateButton, #followUpButton, #newTopicButton").prop("disabled", true).addClass("opacity-50 cursor-not-allowed")
  },

  enableButtons() {
    $("#generateButton, #followUpButton, #newTopicButton").prop("disabled", false).removeClass("opacity-50 cursor-not-allowed")
  },
}
