// app.js

import { calculateCombination } from "./logic.js";
import { renderResults, showError, toggleDetails } from "./ui.js";
import { fetchMenuData } from "./api-client.js";

// --- 設定 ---
const MAX_EXCLUDED_ITEMS = 5;
const SCAN_INTERVAL = 1500;

// --- DOM要素 ---
const balanceInput = document.getElementById("balanceInput");
const searchBtn = document.getElementById("searchBtn");
const resultArea = document.getElementById("resultArea");
const resetExcludedButton = document.getElementById("resetExcludedButton");
const retrySearchBtn = document.getElementById("retrySearchBtn");

// カメラ用DOM要素
const scanBtn = document.getElementById("scanBtn");
const scannerContainer = document.getElementById("scannerContainer");
const stopScanBtn = document.getElementById("stopScanBtn");
// ▼▼▼ 通知用要素の取得 (HTMLに追加します) ▼▼▼
const toastElement = document.getElementById("toast");

// --- 状態 (State) ---
let menuGroups = [];
let isDataLoaded = false;
let userExcludedIds = new Set();
let itemCounts = {};
let lockedGroupIds = new Set();
let coopExcludedQueue = [];
let currentSuggestion = [];

// カメラ用変数
let codeReader = null;
let lastScanTime = 0;

// --- 初期化 ---
window.addEventListener("DOMContentLoaded", async () => {
  menuGroups = await fetchMenuData();
  if (menuGroups.length > 0) {
    isDataLoaded = true;
  } else {
    showError(
      "データの読み込みに失敗しました。再読み込みしてください。",
      resultArea
    );
  }

  document.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const targetId = btn.getAttribute("data-target");
      btn.classList.toggle("active");
      const checkbox = document.getElementById(targetId);
      if (checkbox) checkbox.checked = !checkbox.checked;
      notifyChange();
    });
  });

  balanceInput.addEventListener("input", () => {
    notifyChange();
  });

  if (typeof ZXing !== "undefined") {
    // ▼▼▼ 高速化設定: JANコード(EAN_13)のみに絞るヒントを作成 ▼▼▼
    const hints = new Map();
    // EAN_13 = JANコードです
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.EAN_13,
    ]);

    // ヒントを渡してインスタンス化
    codeReader = new ZXing.BrowserMultiFormatReader(hints);
    console.log("ZXing library initialized with EAN_13 only");
  } else {
    console.warn("ZXing library not found");
  }
});

// --- 変更通知機能 ---
function notifyChange() {
  if (searchBtn) searchBtn.classList.add("needs-update");
  if (retrySearchBtn) retrySearchBtn.classList.add("needs-update");
}

function clearNotification() {
  if (searchBtn) searchBtn.classList.remove("needs-update");
  if (retrySearchBtn) retrySearchBtn.classList.remove("needs-update");
}

// --- グローバル関数登録 ---
window.toggleDetails = toggleDetails;

window.removeSlot = function (id) {
  if (lockedGroupIds.has(id)) {
    alert("ロックを解除してください。");
    return;
  }
  if (userExcludedIds.has(id)) return;
  userExcludedIds.add(id);
  lockedGroupIds.delete(id);
  const group = menuGroups.find((g) => g.id === id);
  if (group && group.isCoop) {
    coopExcludedQueue.push(id);
    if (coopExcludedQueue.length > MAX_EXCLUDED_ITEMS) {
      const oldestId = coopExcludedQueue.shift();
      userExcludedIds.delete(oldestId);
    }
  }
  currentSuggestion = currentSuggestion.filter((item) => item.id !== id);

  if (group) {
    group.items.forEach((item) => {
      if (itemCounts[item.jan]) delete itemCounts[item.jan];
    });
  }

  recalculateAndRender();
  notifyChange();
};

window.toggleGroupLock = function (groupId) {
  if (lockedGroupIds.has(groupId)) {
    lockedGroupIds.delete(groupId);
  } else {
    lockedGroupIds.add(groupId);
    userExcludedIds.delete(groupId);
  }
  recalculateAndRender();
};

window.updateItemCount = function (groupId, jan, delta) {
  const current = itemCounts[jan] || 0;
  const next = current + delta;
  if (next < 0) return;
  itemCounts[jan] = next;
  if (next > 0) {
    userExcludedIds.delete(groupId);
  }
  recalculateAndRender();
};

window.resetGroupItemCounts = function (groupId) {
  const group = menuGroups.find((g) => g.id === groupId);
  if (group) {
    group.items.forEach((item) => {
      if (itemCounts[item.jan]) delete itemCounts[item.jan];
    });
  }
  recalculateAndRender();
};

function recalculateAndRender() {
  const balance = parseInt(balanceInput.value, 10) || 0;

  if (!isDataLoaded) {
    updateCurrentView(0, 0);
    return;
  }

  const filters = {
    bento: document.getElementById("filter-bento")?.checked ?? true,
    onigiri: document.getElementById("filter-onigiri")?.checked ?? true,
    bread: document.getElementById("filter-bread")?.checked ?? true,
    cupmen: document.getElementById("filter-cupmen")?.checked ?? true,
    drink: document.getElementById("filter-drink")?.checked ?? true,
    salad: document.getElementById("filter-salad")?.checked ?? true,
  };

  const result = calculateCombination(
    balance,
    menuGroups,
    userExcludedIds,
    filters,
    itemCounts,
    lockedGroupIds
  );

  currentSuggestion = result.suggestion;
  updateCurrentView(result.total, balance);
}

function performSearch() {
  const balance = parseInt(balanceInput.value, 10);
  if (!balance || balance < 0) {
    alert("金額を入力してください");
    return;
  }
  recalculateAndRender();
  clearNotification();
}

if (searchBtn) searchBtn.addEventListener("click", performSearch);

if (retrySearchBtn) {
  retrySearchBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    performSearch();
  });
}

if (resetExcludedButton) {
  resetExcludedButton.addEventListener("click", () => {
    userExcludedIds.clear();
    itemCounts = {};
    lockedGroupIds.clear();
    currentSuggestion = [];
    updateCurrentView(0, 0);
    resultArea.innerHTML =
      '<div class="empty-state">リセットしました。<br>「提案」ボタンを押してランチを決めましょう！</div>';
    clearNotification();
  });
}

function updateCurrentView(calculatedTotal, balance) {
  calculatedTotal = calculatedTotal || 0;
  balance = balance || 0;

  const openGroupIds = new Set();
  document.querySelectorAll(".details-container.open").forEach((el) => {
    const id = el.id.replace("details-", "");
    openGroupIds.add(id);
  });

  const uniqueGroups = [];
  const groupIds = new Set();

  currentSuggestion.forEach((item) => {
    if (!groupIds.has(item.id)) {
      uniqueGroups.push(item);
      groupIds.add(item.id);
    }
  });

  renderResults(
    uniqueGroups,
    balance,
    resultArea,
    itemCounts,
    lockedGroupIds,
    calculatedTotal,
    openGroupIds
  );
}

// ---------------------------------------------------------
// ▼▼▼ カメラ機能の実装 (高速化設定済み) ▼▼▼
// ---------------------------------------------------------

if (scanBtn) {
  scanBtn.addEventListener("click", () => {
    startScanning();
  });
}

if (stopScanBtn) {
  stopScanBtn.addEventListener("click", () => {
    stopScanning();
  });
}

function startScanning() {
  if (!codeReader) {
    alert("カメラスキャナの準備ができていません。リロードしてください。");
    return;
  }

  scanBtn.style.display = "none";
  scannerContainer.style.display = "block";

  codeReader
    .decodeFromVideoDevice(null, "video", (result, err) => {
      if (result) {
        const now = Date.now();
        if (now - lastScanTime < SCAN_INTERVAL) {
          return;
        }
        lastScanTime = now;

        console.log("Scanned:", result.text);
        handleJanScanSuccess(result.text);
      }
    })
    .catch((err) => {
      console.error(err);
      alert("カメラの起動に失敗しました。");
      stopScanning();
    });
}

function stopScanning() {
  if (codeReader) {
    codeReader.reset();
  }
  scannerContainer.style.display = "none";
  scanBtn.style.display = "inline-block";
}

function handleJanScanSuccess(scannedJan) {
  let foundItem = null;
  let targetGroupId = null;

  for (const group of menuGroups) {
    const item = group.items.find((i) => i.jan === scannedJan);
    if (item) {
      foundItem = item;
      targetGroupId = group.id;
      break;
    }
  }

  if (!foundItem) {
    console.warn(`JAN not found: ${scannedJan}`);
    showToast("メニューに見つかりません", "error");
    return;
  }

  const currentCount = itemCounts[scannedJan] || 0;
  itemCounts[scannedJan] = currentCount + 1;

  if (userExcludedIds.has(targetGroupId)) {
    userExcludedIds.delete(targetGroupId);
  }

  recalculateAndRender();
  clearNotification();

  // ▼▼▼ トースト通知を表示 ▼▼▼
  showToast(`${foundItem.name} を追加しました`);
}

// ▼▼▼ トースト表示関数 ▼▼▼
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast show ${type}`; // typeによって色を変えることも可能

  // 3秒後に消える
  setTimeout(() => {
    toast.className = toast.className.replace("show", "");
  }, 2500);
}
