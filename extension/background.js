/**
 * PITCH.FYLYM Extension — Background Service Worker (MV3)
 *
 * Responsibilities:
 *  1. Store auth token + cached project/opportunity data
 *  2. Show badge when current tab URL matches a known fund form
 *  3. Handle messages from popup and content script
 *  4. Fetch /api/autofill/context from PITCH.FYLYM
 */

const API_BASE = "https://pitch.fylym.com";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getStorage() {
  return chrome.storage.local.get([
    "token", "userId", "userName",
    "projects", "opportunities", "selectedProjectId",
  ]);
}

async function fetchContext(token) {
  const res = await fetch(`${API_BASE}/api/autofill/context`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json(); // { projects, opportunities }
}

function urlMatchesOpportunity(url, opportunities) {
  if (!url || !opportunities?.length) return null;
  try {
    const tabHost = new URL(url).hostname.replace(/^www\./, "");
    return opportunities.find((o) => {
      if (!o.form_url) return false;
      const oppHost = new URL(o.form_url).hostname.replace(/^www\./, "");
      return tabHost === oppHost;
    }) ?? null;
  } catch {
    return null;
  }
}

async function updateBadge(tabId, url) {
  const { opportunities } = await getStorage();
  const match = urlMatchesOpportunity(url, opportunities);
  if (match) {
    chrome.action.setBadgeText({ text: "✦", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#BF9953", tabId });
    chrome.action.setTitle({ title: `PITCH.FYLYM — Fill: ${match.title}`, tabId });
  } else {
    chrome.action.setBadgeText({ text: "", tabId });
    chrome.action.setTitle({ title: "PITCH.FYLYM", tabId });
  }
}

// ── Install ───────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    token: null,
    userId: null,
    userName: null,
    projects: [],
    opportunities: [],
    selectedProjectId: null,
  });
});

// ── Tab tracking ─────────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    updateBadge(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url) updateBadge(tabId, tab.url);
});

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // ── Auth received from extension-connect page (via content.js relay) ──────
  if (msg.type === "STORE_AUTH") {
    (async () => {
      try {
        const { projects, opportunities } = await fetchContext(msg.token);
        // Fetch user name from first project filmmaker or fall back to email
        await chrome.storage.local.set({
          token: msg.token,
          userId: msg.userId,
          projects: projects ?? [],
          opportunities: opportunities ?? [],
          selectedProjectId: projects?.[0]?.id ?? null,
        });
        sendResponse({ ok: true, projectCount: projects?.length ?? 0 });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // async
  }

  // ── Popup requests current state ──────────────────────────────────────────
  if (msg.type === "GET_STATE") {
    (async () => {
      const state = await getStorage();
      // Get current tab URL to check if we're on a matching fund form
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const matchedOpp = urlMatchesOpportunity(tab?.url, state.opportunities);
      sendResponse({ ...state, matchedOpp: matchedOpp ?? null, tabUrl: tab?.url });
    })();
    return true;
  }

  // ── Popup requests fill on current tab ────────────────────────────────────
  if (msg.type === "FILL_REQUEST") {
    (async () => {
      try {
        const state = await getStorage();
        const projectId = msg.projectId ?? state.selectedProjectId;
        const project   = state.projects?.find((p) => p.id === projectId);
        if (!project) { sendResponse({ ok: false, error: "No project selected" }); return; }

        // Find opportunity matching current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const matchedOpp = urlMatchesOpportunity(tab?.url, state.opportunities);

        await chrome.tabs.sendMessage(tab.id, {
          type:      "FILL_FORM",
          project,
          fieldMap:  matchedOpp?.form_field_map ?? null,
          fundTitle: matchedOpp?.title ?? "Fund",
        });

        // Save selected project for next time
        await chrome.storage.local.set({ selectedProjectId: projectId });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  // ── Refresh context data ──────────────────────────────────────────────────
  if (msg.type === "REFRESH") {
    (async () => {
      try {
        const { token } = await getStorage();
        if (!token) { sendResponse({ ok: false, error: "Not connected" }); return; }
        const { projects, opportunities } = await fetchContext(token);
        await chrome.storage.local.set({ projects, opportunities });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  // ── Disconnect ────────────────────────────────────────────────────────────
  if (msg.type === "DISCONNECT") {
    chrome.storage.local.set({
      token: null, userId: null, userName: null,
      projects: [], opportunities: [], selectedProjectId: null,
    }, () => sendResponse({ ok: true }));
    return true;
  }
});
