// SolanaPilot Chat Webview Client Script
(function () {
  // Acquire VS Code API
  // @ts-ignore
  const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : {
    postMessage: function (msg) {
      console.log("[Webview Mock] postMessage:", msg);
    },
  };

  let currentMode = "ask";
  let activePreviewId = null;

  // DOM Elements
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const clearBtn = document.getElementById("clear-btn");
  const chatFeed = document.getElementById("chat-feed");
  const modeAskBtn = document.getElementById("mode-ask");
  const modeAgentBtn = document.getElementById("mode-agent");
  const providerSelect = document.getElementById("provider-select");
  const modelSelect = document.getElementById("model-select");

  const pipelineSection = document.getElementById("pipeline-progress");
  const pipelineCurrentStep = document.getElementById("pipeline-current-step");
  const stageList = document.getElementById("stage-list");
  const budgetVal = document.getElementById("budget-val");
  const budgetBarFill = document.getElementById("budget-bar-fill");

  const errorBanner = document.getElementById("error-banner");
  const errorCategory = document.getElementById("error-category");
  const errorMessage = document.getElementById("error-message");
  const errorDismiss = document.getElementById("error-dismiss");

  const planPreview = document.getElementById("plan-preview");
  const planDetails = document.getElementById("plan-details");
  const planApproveBtn = document.getElementById("plan-approve-btn");
  const planCancelBtn = document.getElementById("plan-cancel-btn");

  const reviewFindings = document.getElementById("review-findings");
  const findingsList = document.getElementById("findings-list");
  const reviewSummaryBadge = document.getElementById("review-summary-badge");

  const buildLog = document.getElementById("build-log");
  const buildLogContent = document.getElementById("build-log-content");

  const receiptSummary = document.getElementById("receipt-summary");
  const receiptGrid = document.getElementById("receipt-grid");

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  function setMode(mode) {
    currentMode = mode;
    if (mode === "ask") {
      modeAskBtn?.classList.add("active");
      modeAgentBtn?.classList.remove("active");
    } else {
      modeAgentBtn?.classList.add("active");
      modeAskBtn?.classList.remove("active");
    }
  }

  function showError(text, category) {
    if (!errorBanner) return;
    const cat = category || "internal";
    if (errorCategory) errorCategory.textContent = `[${cat}]`;
    if (errorMessage) errorMessage.textContent = text || "An unexpected error occurred.";
    errorBanner.classList.remove("hidden");
  }

  function hideError() {
    if (errorBanner) errorBanner.classList.add("hidden");
  }

  function updatePipelineStage(stageName, status) {
    if (!stageList) return;
    const item = stageList.querySelector(`[data-stage="${stageName}"]`);
    if (item) {
      item.classList.remove("running", "completed", "failed");
      if (status) item.classList.add(status);
    }
  }

  function updateBudget(usedSteps, maxSteps) {
    if (!budgetVal || !budgetBarFill) return;
    const used = usedSteps || 0;
    const max = maxSteps || 20;
    budgetVal.textContent = `${used} / ${max} steps`;
    const pct = Math.min(100, Math.round((used / max) * 100));
    budgetBarFill.style.width = `${pct}%`;
  }

  function appendChatMessage(text, sender, mode) {
    if (!chatFeed) return;
    const welcome = chatFeed.querySelector(".chat-welcome");
    if (welcome) welcome.remove();

    const msgItem = document.createElement("div");
    msgItem.className = `message-item ${sender}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    // Format simple markdown (code blocks, inline code, bold)
    renderFormattedText(bubble, text);

    const meta = document.createElement("div");
    meta.className = "message-meta";
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    meta.textContent = `${sender === "user" ? "You" : "SolanaPilot"} • ${timeStr}${mode ? ` [${mode}]` : ""}`;

    msgItem.appendChild(bubble);
    msgItem.appendChild(meta);
    chatFeed.appendChild(msgItem);
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  function renderFormattedText(container, rawText) {
    const lines = (rawText || "").split("\n");
    let inCode = false;
    let codeLang = "";
    let codeBuffer = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("```")) {
        if (!inCode) {
          inCode = true;
          codeLang = line.slice(3).trim();
          codeBuffer = [];
        } else {
          inCode = false;
          appendCodeBlock(container, codeBuffer.join("\n"), codeLang);
        }
      } else if (inCode) {
        codeBuffer.push(line);
      } else {
        const p = document.createElement("p");
        p.textContent = line;
        container.appendChild(p);
      }
    }

    if (inCode && codeBuffer.length > 0) {
      appendCodeBlock(container, codeBuffer.join("\n"), codeLang);
    }
  }

  function appendCodeBlock(container, code, lang) {
    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";

    const header = document.createElement("div");
    header.className = "code-header";
    const langSpan = document.createElement("span");
    langSpan.textContent = lang || "code";

    const actions = document.createElement("div");
    actions.className = "code-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "code-btn";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", function () {
      navigator.clipboard?.writeText(code).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
      });
    });

    const insertBtn = document.createElement("button");
    insertBtn.className = "code-btn";
    insertBtn.type = "button";
    insertBtn.textContent = "Insert";
    insertBtn.addEventListener("click", function () {
      vscode.postMessage({ type: "insertCode", code: code });
    });

    actions.appendChild(copyBtn);
    actions.appendChild(insertBtn);
    header.appendChild(langSpan);
    header.appendChild(actions);

    const pre = document.createElement("pre");
    pre.className = "code-content";
    const codeEl = document.createElement("code");
    codeEl.textContent = code;
    pre.appendChild(codeEl);

    wrapper.appendChild(header);
    wrapper.appendChild(pre);
    container.appendChild(wrapper);
  }

  function renderPlanPreview(previewId, files) {
    activePreviewId = previewId;
    if (!planPreview || !planDetails) return;

    planDetails.innerHTML = "";
    if (files && files.length) {
      const ul = document.createElement("ul");
      ul.className = "preview-files-list";
      files.forEach((f) => {
        const li = document.createElement("li");
        li.textContent = `${f.path} (${f.content.length} bytes)`;
        ul.appendChild(li);
      });
      planDetails.appendChild(ul);
    } else {
      planDetails.textContent = "No specific files in this plan.";
    }

    planPreview.classList.remove("hidden");
  }

  function hidePlanPreview() {
    activePreviewId = null;
    if (planPreview) planPreview.classList.add("hidden");
  }

  function handleSend() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    appendChatMessage(text, "user", currentMode);
    chatInput.value = "";
    chatInput.style.height = "auto";
    hideError();

    vscode.postMessage({
      type: "ask",
      text: text,
      mode: currentMode,
    });
  }

  // Event Listeners
  modeAskBtn?.addEventListener("click", () => setMode("ask"));
  modeAgentBtn?.addEventListener("click", () => setMode("agent"));

  errorDismiss?.addEventListener("click", () => hideError());

  chatForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSend();
  });

  clearBtn?.addEventListener("click", () => {
    if (chatFeed) {
      chatFeed.innerHTML = `
        <div class="chat-welcome">
          <p class="welcome-heading">Welcome to SolanaPilot</p>
          <p class="welcome-sub">Ask a Solana question or switch to Agent mode to design, build, test, and deploy Solana programs autonomously.</p>
        </div>`;
    }
    vscode.postMessage({ type: "clearHistory" });
  });

  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  chatInput?.addEventListener("input", () => {
    if (chatInput) {
      chatInput.style.height = "auto";
      chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + "px";
    }
  });

  planApproveBtn?.addEventListener("click", () => {
    if (activePreviewId) {
      vscode.postMessage({
        type: "workspacePreviewChoice",
        previewId: activePreviewId,
        choice: "write",
      });
      hidePlanPreview();
    }
  });

  planCancelBtn?.addEventListener("click", () => {
    if (activePreviewId) {
      vscode.postMessage({
        type: "workspacePreviewChoice",
        previewId: activePreviewId,
        choice: "cancel",
      });
      hidePlanPreview();
    }
  });

  // Message listener from extension
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg) return;

    switch (msg.type) {
      case "response":
        appendChatMessage(msg.text || "", "assistant", msg.mode);
        break;

      case "thinking":
        if (pipelineCurrentStep) {
          pipelineCurrentStep.textContent = msg.text || "Thinking...";
        }
        break;

      case "error":
        showError(msg.text || "An unknown error occurred", "internal");
        break;

      case "workspacePreview":
        renderPlanPreview(msg.previewId, msg.files);
        break;

      case "insertCode":
        vscode.postMessage({ type: "insertCode", code: msg.code });
        break;
    }
  });
})();
