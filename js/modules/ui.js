import { CommandGenerator } from "./command-generator.js"
import { SettingsManager } from "./settings.js"

export const UI = {
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

    // Initialize generate button click handler
    $("#generateButton").on("click", function () {
      CommandGenerator.generate()
    })
  },

  showSettings() {
    // Create settings modal if it doesn't exist
    if (!$(".settings-modal").length) {
      const settings = SettingsManager.get()
      const modalHtml = `
        <div class="settings-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-[500px] max-h-[90vh] overflow-y-auto">
            <div class="p-6">
              <h2 class="text-xl font-semibold text-gray-800 mb-6">Settings</h2>
              
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input type="text" id="apiKey" value="${settings.apiKey || ""}" 
                    placeholder="sk-..." 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">URL</label>
                  <input type="text" id="url" value="${settings.url || ""}" 
                    placeholder="https://api.openai.com/v1/chat/completions"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input type="text" id="model" value="${settings.model}" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                  <input type="number" id="temperature" value="${settings.temperature}" step="0.1" min="0" max="2"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Max History</label>
                  <input type="number" id="maxHistory" value="${settings.maxHistory}" min="1"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <p class="mt-1 text-sm text-gray-500">继续追问时，发送给 GPT 的最大历史对话数量</p>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
                  <textarea id="userPrompt" rows="4" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">${settings.userPrompt}</textarea>
                </div>
              </div>
              
              <div class="flex justify-end gap-3 mt-6">
                <button class="reset-button px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Reset</button>
                <button class="cancel-button px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
                <button class="save-button px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">Save</button>
              </div>
            </div>
          </div>
        </div>
      `
      $("body").append(modalHtml)

      // Add event handlers
      $(".settings-modal").on("click", (e) => {
        if (e.target === e.currentTarget) {
          this.hideSettings()
        }
      })

      $(".save-button").on("click", () => {
        const newSettings = {
          apiKey: $("#apiKey").val().trim(),
          url: $("#url").val().trim(),
          model: $("#model").val().trim(),
          temperature: parseFloat($("#temperature").val()),
          maxHistory: parseInt($("#maxHistory").val()),
          userPrompt: $("#userPrompt").val(),
        }
        SettingsManager.save(newSettings)
        this.hideSettings()
      })

      $(".cancel-button").on("click", () => this.hideSettings())
      $(".reset-button").on("click", () => {
        SettingsManager.reset()
        this.hideSettings()
      })
    }

    $(".settings-modal").removeClass("hidden")
  },

  hideSettings() {
    $(".settings-modal").remove()
  },

  renderCommandExplanation(explanations, command) {
    return explanations
      .map((explanation) => {
        let html = `<div class="explanation-item">`

        // Add command name and description
        html += `
          <div class="mb-2">
            <span class="font-medium text-gray-800">${explanation.name}</span>
            <p class="text-gray-700">${explanation.description}</p>
          </div>
        `

        // Add parameters if present
        if (explanation.parameters && explanation.parameters.length > 0) {
          html += `
            <div class="mt-2">
              <div class="font-medium text-gray-700 mb-1">参数说明：</div>
              <ul class="list-disc pl-5 space-y-1">
                ${explanation.parameters
                  .map(
                    (param) => `
                  <li>
                    <code class="text-sm bg-gray-100 px-1 rounded">${param.flag}</code>
                    <span class="text-gray-700">${param.description}</span>
                    ${
                      param.details
                        ? `
                      <ul class="mt-2 ml-4 space-y-1 text-sm text-gray-600">
                        ${param.details.map((detail) => `<li>${detail}</li>`).join("")}
                      </ul>
                    `
                        : ""
                    }
                  </li>`
                  )
                  .join("")}
              </ul>
            </div>
          `
        }

        html += "</div>"
        return html
      })
      .join("<hr class='my-3 border-gray-200'>")
  },
}
