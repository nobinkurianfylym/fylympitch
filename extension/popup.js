/**
 * PITCH.FYLYM Extension — Popup Script
 */

const FYLYM_CONNECT_URL = "https://pitch.fylym.com/extension-connect";

// ── DOM refs ─────────────────────────────────────────────────────────────────

const screens = {
  loading:      document.getElementById("screen-loading"),
  disconnected: document.getElementById("screen-disconnected"),
  connected:    document.getElementById("screen-connected"),
};

const el = {
  userLabel:    document.getElementById("user-label"),
  projectSelect: document.getElementById("project-select"),
  fillBtn:      document.getElementById("fill-btn"),
  connectBtn:   document.getElementById("connect-btn"),
  disconnectBtn: document.getElementById("disconnect-btn"),
  refreshBtn:   document.getElementById("refresh-btn"),
  fundMatch:    document.getElementById("fund-match"),
  fundName:     document.getElementById("fund-name"),
  noMatch:      document.getElementById("no-match"),
  resultMsg:    document.getElementById("result-msg"),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

function showResult(text, ok) {
  el.resultMsg.textContent = text;
  el.resultMsg.className = `result ${ok ? "ok" : "err"}`;
  el.resultMsg.classList.remove("hidden");
  setTimeout(() => el.resultMsg.classList.add("hidden"), 4000);
}

function send(msg) {
  return new Promise((res) => chrome.runtime.sendMessage(msg, res));
}

// ── Render connected state ────────────────────────────────────────────────────

function renderConnected(state) {
  showScreen("connected");

  // User label
  el.userLabel.textContent = state.userName ?? `${state.projects?.length ?? 0} project(s) loaded`;

  // Project dropdown
  const projects = state.projects ?? [];
  el.projectSelect.innerHTML = "";
  if (projects.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No projects — add one on PITCH.FYLYM";
    el.projectSelect.appendChild(opt);
  } else {
    projects.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.title;
      if (p.id === state.selectedProjectId) opt.selected = true;
      el.projectSelect.appendChild(opt);
    });
  }

  // Fund match
  if (state.matchedOpp) {
    el.fundName.textContent = state.matchedOpp.title;
    el.fundMatch.classList.remove("hidden");
    el.noMatch.classList.add("hidden");
    el.fillBtn.disabled = projects.length === 0;
  } else {
    el.fundMatch.classList.add("hidden");
    el.noMatch.classList.remove("hidden");
    el.fillBtn.disabled = true;
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  showScreen("loading");
  const state = await send({ type: "GET_STATE" });
  if (state?.token) {
    renderConnected(state);
  } else {
    showScreen("disconnected");
  }
}

// ── Connect ───────────────────────────────────────────────────────────────────

el.connectBtn?.addEventListener("click", () => {
  chrome.tabs.create({ url: FYLYM_CONNECT_URL });
  // Listen for state change (background stores auth and we re-init)
  const interval = setInterval(async () => {
    const state = await send({ type: "GET_STATE" });
    if (state?.token) {
      clearInterval(interval);
      renderConnected(state);
    }
  }, 1000);
  // Stop polling after 60s
  setTimeout(() => clearInterval(interval), 60_000);
});

// ── Fill ──────────────────────────────────────────────────────────────────────

el.fillBtn?.addEventListener("click", async () => {
  const projectId = el.projectSelect.value;
  if (!projectId) return;

  el.fillBtn.disabled = true;
  el.fillBtn.textContent = "Filling…";

  const res = await send({ type: "FILL_REQUEST", projectId });

  el.fillBtn.disabled = false;
  el.fillBtn.textContent = "Fill This Form";

  if (res?.ok) {
    showResult(`✦ Filled ${res.filled} field${res.filled !== 1 ? "s" : ""}`, true);
  } else {
    showResult(res?.error ?? "Fill failed — no matching fields found", false);
  }
});

// ── Disconnect ────────────────────────────────────────────────────────────────

el.disconnectBtn?.addEventListener("click", async () => {
  await send({ type: "DISCONNECT" });
  showScreen("disconnected");
});

// ── Refresh ───────────────────────────────────────────────────────────────────

el.refreshBtn?.addEventListener("click", async () => {
  el.refreshBtn.textContent = "…";
  el.refreshBtn.disabled = true;
  await send({ type: "REFRESH" });
  await init();
  el.refreshBtn.textContent = "↻";
  el.refreshBtn.disabled = false;
});

// ── Project select change ─────────────────────────────────────────────────────

el.projectSelect?.addEventListener("change", () => {
  chrome.storage.local.set({ selectedProjectId: el.projectSelect.value });
});

// ── Boot ─────────────────────────────────────────────────────────────────────

init();
