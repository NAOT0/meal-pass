// app.js

import { calculateCombination } from "./logic.js";
import { renderResults, showError, toggleDetails } from "./ui.js";
import { fetchMenuData } from "./api-client.js";

// --- 設定 ---
const MAX_EXCLUDED_ITEMS = 5;

// --- DOM要素 ---
const balanceInput = document.getElementById("balanceInput");
const searchBtn = document.getElementById("searchBtn");
const resultArea = document.getElementById("resultArea");
const resetExcludedButton = document.getElementById("resetExcludedButton");
const retrySearchBtn = document.getElementById("retrySearchBtn");

// ▼▼▼ カメラ用DOM要素の取得 ▼▼▼
const scanBtn = document.getElementById("scanBtn");
const scannerContainer = document.getElementById("scannerContainer");
const stopScanBtn = document.getElementById("stopScanBtn");
const videoElement = document.getElementById("video");

// --- 状態 (State) ---
let menuGroups = [];
let isDataLoaded = false;
let userExcludedIds = new Set();
let itemCounts = {};
let lockedGroupIds = new Set();
let coopExcludedQueue = [];
let currentSuggestion = [];

// ▼▼▼ カメラ用変数 ▼▼▼
let codeReader = null;
let activeStream = null;

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

  // フィルタのイベントなどは既存のまま...
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

  // ▼▼▼ ライブラリの準備 ▼▼▼
  // HTMLのscriptタグで読み込まれた ZXing があるか確認
  if (typeof ZXing !== "undefined") {
    codeReader = new ZXing.BrowserMultiFormatReader();
    console.log("ZXing library initialized");
  } else {
    console.error("ZXing library not found");
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
  updateCurrentView();
  notifyChange();
};

window.toggleGroupLock = function (groupId) {
  if (lockedGroupIds.has(groupId)) {
    lockedGroupIds.delete(groupId);
  } else {
    lockedGroupIds.add(groupId);
    userExcludedIds.delete(groupId);
  }
  updateCurrentView();
};

window.updateItemCount = function (groupId, jan, delta) {
  const current = itemCounts[jan] || 0;
  const next = current + delta;
  if (next < 0) return;
  itemCounts[jan] = next;
  if (next > 0) {
    userExcludedIds.delete(groupId);
  }
  updateCurrentView();
};

window.resetGroupItemCounts = function (groupId) {
  const group = menuGroups.find((g) => g.id === groupId);
  if (group) {
    group.items.forEach((item) => {
      if (itemCounts[item.jan]) delete itemCounts[item.jan];
    });
  }
  updateCurrentView();
};

// --- 検索アクション ---
function performSearch() {
  if (!isDataLoaded) return;
  const balance = parseInt(balanceInput.value, 10);
  if (!balance || balance < 0) {
    alert("金額を入力してください");
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
  updateCurrentView();
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
    updateCurrentView();
    resultArea.innerHTML =
      '<div class="empty-state">リセットしました。<br>「提案」ボタンを押してランチを決めましょう！</div>';
    document.getElementById("footerTotal").textContent = "¥ 0";
    document.getElementById("footerRemain").textContent = "¥ 0";
    document.getElementById("footerStatus").innerHTML = "";
    clearNotification();
  });
}

function updateCurrentView() {
  const balance = parseInt(balanceInput.value, 10) || 0;
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

  let total = 0;
  uniqueGroups.forEach((group) => {
    let countInGroup = 0;
    let hasExplicitCount = false;
    group.items.forEach((i) => {
      const c = itemCounts[i.jan] || 0;
      if (c > 0) {
        countInGroup += c;
        hasExplicitCount = true;
      }
    });
    if (!hasExplicitCount) countInGroup = 1;
    total += group.price * countInGroup;
  });

  renderResults(
    uniqueGroups,
    balance,
    resultArea,
    itemCounts,
    lockedGroupIds,
    total,
    openGroupIds
  );
}

// ---------------------------------------------------------
// ▼▼▼ カメラ機能の実装 (Global変数 ZXing を使用) ▼▼▼
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

  // UI切り替え
  scanBtn.style.display = "none";
  scannerContainer.style.display = "block";

  // カメラを起動してデコード開始
  // null = 最初のカメラ, video = <video>のID
  codeReader
    .decodeFromVideoDevice(null, "video", (result, err) => {
      if (result) {
        console.log("Scanned:", result.text);
        // 成功時の音など鳴らしてもOK
        handleJanScanSuccess(result.text);
        stopScanning();
      }
      // エラーはコンソールに出るが、スキャン中は頻発するので無視してOK
    })
    .then((controls) => {
      // 停止用にコントロールを保持などはライブラリが内部管理する場合もあるが
      // 今回は単純に reset() で止める
    })
    .catch((err) => {
      console.error(err);
      alert("カメラの起動に失敗しました。");
      stopScanning();
    });
}

function stopScanning() {
  if (codeReader) {
    // スキャン停止・カメラ解放
    codeReader.reset();
  }
  scannerContainer.style.display = "none";
  scanBtn.style.display = "inline-block";
}

// JANコードヒット時の処理
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
    alert(`JANコード: ${scannedJan}\nメニューに見つかりませんでした。`);
    return;
  }

  // カウントアップ
  const currentCount = itemCounts[scannedJan] || 0;
  itemCounts[scannedJan] = currentCount + 1;

  if (userExcludedIds.has(targetGroupId)) {
    userExcludedIds.delete(targetGroupId);
  }

  // 再計算
  updateCurrentView();
  clearNotification();

  // ユーザーへのフィードバック（任意）
  // alert(`${foundItem.name} を追加しました`);
}
