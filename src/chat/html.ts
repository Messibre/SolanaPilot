export interface WebviewHtmlOptions {
  cspSource: string;
  styleUri: string;
  scriptUri: string;
  nonce: string;
}

export function buildChatHtml(options: WebviewHtmlOptions): string {
  const { cspSource, styleUri, scriptUri, nonce } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${cspSource}; script-src 'nonce-${nonce}'; img-src ${cspSource} data:; font-src ${cspSource};"
  />
  <title>SolanaPilot</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body class="solanapilot-app">
  <header class="app-header">
    <div class="header-branding">
      <h1 class="app-title">SolanaPilot</h1>
      <span class="app-tagline">Autonomous AI Toolkit for Solana</span>
    </div>
    <div class="header-controls">
      <div class="select-group">
        <label for="provider-select" class="sr-only">Select AI Provider</label>
        <select id="provider-select" class="ui-select" aria-label="Select AI Provider">
          <option value="anthropic">Anthropic Claude</option>
          <option value="gemini">Google Gemini</option>
          <option value="openai">OpenAI Compatible</option>
          <option value="ollama">Ollama (Local)</option>
          <option value="deepseek">DeepSeek</option>
        </select>
      </div>
      <div class="select-group">
        <label for="model-select" class="sr-only">Select Model</label>
        <select id="model-select" class="ui-select" aria-label="Select Model">
          <option value="claude-3-7-sonnet">claude-3-7-sonnet</option>
          <option value="gemini-2.5-pro">gemini-2.5-pro</option>
          <option value="gpt-4o">gpt-4o</option>
        </select>
      </div>
      <div class="mode-toggle" role="group" aria-label="Execution mode">
        <button id="mode-ask" class="mode-btn active" type="button" data-mode="ask">Ask</button>
        <button id="mode-agent" class="mode-btn" type="button" data-mode="agent">Agent</button>
      </div>
    </div>
  </header>

  <!-- Pipeline Progress View -->
  <section id="pipeline-progress" class="pipeline-section" aria-live="polite">
    <div class="pipeline-header">
      <h2 class="pipeline-title">Pipeline Status</h2>
      <div class="current-step" id="pipeline-current-step">Idle</div>
    </div>
    <ol class="stage-list" id="stage-list">
      <li class="stage-item" data-stage="PLAN"><span class="stage-status-dot"></span>PLAN</li>
      <li class="stage-item" data-stage="GENERATE"><span class="stage-status-dot"></span>GENERATE</li>
      <li class="stage-item" data-stage="BUILD"><span class="stage-status-dot"></span>BUILD</li>
      <li class="stage-item" data-stage="FIX"><span class="stage-status-dot"></span>FIX</li>
      <li class="stage-item" data-stage="TEST"><span class="stage-status-dot"></span>TEST</li>
      <li class="stage-item" data-stage="REVIEW"><span class="stage-status-dot"></span>REVIEW</li>
      <li class="stage-item" data-stage="DEPLOY"><span class="stage-status-dot"></span>DEPLOY</li>
      <li class="stage-item" data-stage="REGISTER"><span class="stage-status-dot"></span>REGISTER</li>
    </ol>
    <div class="budget-container" id="budget-meter">
      <div class="budget-label-row">
        <span class="budget-label">Step & Token Budget</span>
        <span class="budget-val" id="budget-val">0 / 20 steps</span>
      </div>
      <div class="budget-bar-track">
        <div class="budget-bar-fill" id="budget-bar-fill" style="width: 0%"></div>
      </div>
    </div>
  </section>

  <!-- Friendly Error Banner -->
  <div id="error-banner" class="error-banner hidden" role="alert">
    <div class="error-badge" id="error-category">[internal]</div>
    <div class="error-message" id="error-message"></div>
    <button id="error-dismiss" class="btn-icon" type="button" aria-label="Dismiss error">✕</button>
  </div>

  <!-- Plan Preview with Approve/Cancel -->
  <section id="plan-preview" class="plan-preview hidden">
    <div class="preview-header">
      <h3 class="preview-title">Proposed Architecture Plan</h3>
      <span class="preview-badge">Action Required</span>
    </div>
    <div class="plan-details" id="plan-details"></div>
    <div class="preview-actions">
      <button id="plan-approve-btn" class="btn btn-primary" type="button">Approve & Execute</button>
      <button id="plan-cancel-btn" class="btn btn-secondary" type="button">Cancel</button>
    </div>
  </section>

  <!-- Review Findings Card -->
  <section id="review-findings" class="review-findings hidden">
    <div class="review-header">
      <h3 class="review-title">Security & Safety Audit Findings</h3>
      <span class="review-summary-badge" id="review-summary-badge">0 Issues</span>
    </div>
    <ul class="findings-list" id="findings-list"></ul>
  </section>

  <!-- Build / Fix Log -->
  <section id="build-log" class="build-log hidden">
    <details>
      <summary class="log-summary">Build & Fix Compiler Diagnostic Log</summary>
      <pre class="log-content" id="build-log-content"><code>No build logs yet.</code></pre>
    </details>
  </section>

  <!-- Run Receipt Summary -->
  <section id="receipt-summary" class="receipt-summary hidden">
    <div class="receipt-header">
      <h3 class="receipt-title">Run Receipt Summary</h3>
    </div>
    <div class="receipt-grid" id="receipt-grid"></div>
  </section>

  <!-- Main Chat Conversation Feed -->
  <main class="chat-feed" id="chat-feed" aria-live="polite" aria-label="Chat messages">
    <div class="chat-welcome">
      <p class="welcome-heading">Welcome to SolanaPilot</p>
      <p class="welcome-sub">Ask a Solana question or switch to Agent mode to design, build, test, and deploy Solana programs autonomously.</p>
    </div>
  </main>

  <!-- Chat Input Footer -->
  <footer class="app-footer">
    <form id="chat-form" class="chat-form">
      <div class="input-container">
        <label for="chat-input" class="sr-only">Enter your prompt or command</label>
        <textarea
          id="chat-input"
          class="chat-textarea"
          rows="1"
          placeholder="Type a prompt (Enter to send, Shift+Enter for new line)..."
          aria-label="Enter your prompt or command"
        ></textarea>
        <div class="input-actions">
          <button id="clear-btn" class="btn btn-secondary" type="button">Clear</button>
          <button id="send-btn" class="btn btn-primary" type="submit">Send</button>
        </div>
      </div>
    </form>
  </footer>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
