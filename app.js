// app.js

import { calculateCombination } from "./logic.js";
import { renderResults, showError, toggleDetails } from "./ui.js";
import { fetchMenuData } from "./api-client.js";

// CDNで読み込んだライブラリを使うため、importは不要

// --- 設定 ---
const MAX_EXCLUDED_ITEMS = 5;

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

// --- 状態 (State) ---
let menuGroups = [];
let isDataLoaded = false;
let userExcludedIds = new Set();
let itemCounts = {};
let lockedGroupIds = new Set();
let coopExcludedQueue = [];
let currentSuggestion = [];

// カメラ用変数
let codeReader = null; // window.ZXing.BrowserMultiFormatReaderのインスタンスが入る

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

  // ▼▼▼ カメラ用ライブラリの準備 ▼▼▼
  if (typeof ZXing !== "undefined") {
    // ZXingライブラリがHTMLで読み込まれていることを確認
    codeReader = new ZXing.BrowserMultiFormatReader();
    console.log("ZXing library initialized");
  } else {
    // ライブラリがロードされていない場合、検索ボタンを押すまでは静かにエラーとする
    console.warn("ZXing library not found (check index.html script tag)");
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

// --- グローバル関数登録（省略） ---
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
  recalculateAndRender(); // 枠の削除後も再計算が必要です
  notifyChange();
};

window.toggleGroupLock = function (groupId) {
  if (lockedGroupIds.has(groupId)) {
    lockedGroupIds.delete(groupId);
  } else {
    lockedGroupIds.add(groupId);
    userExcludedIds.delete(groupId);
  }
  recalculateAndRender(); // ロック変更後も再計算が必要です
};

window.updateItemCount = function (groupId, jan, delta) {
  const current = itemCounts[jan] || 0;
  const next = current + delta;
  if (next < 0) return;
  itemCounts[jan] = next;
  if (next > 0) {
    userExcludedIds.delete(groupId);
  }
  recalculateAndRender(); // 個数変更後も再計算が必要です
};

window.resetGroupItemCounts = function (groupId) {
  const group = menuGroups.find((g) => g.id === groupId);
  if (group) {
    group.items.forEach((item) => {
      if (itemCounts[item.jan]) delete itemCounts[item.jan];
    });
  }
  recalculateAndRender(); // リセット後も再計算が必要です
};

// ---------------------------------------------------------
// ▼▼▼ 修正・追加: 再計算処理を独立させる ▼▼▼
// ---------------------------------------------------------

/**
 * 現在の状態（残高、個数指定、フィルター）に基づいて組み合わせを計算し、
 * 結果を画面にレンダリングする
 */
function recalculateAndRender() {
  const balance = parseInt(balanceInput.value, 10) || 0;

  if (!isDataLoaded || !balance) {
    // データ未ロード、または残高なしの場合は再計算しない
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

  // logic.js側でランダム制限とユニーク化が行われている
  currentSuggestion = result.suggestion;

  // 画面更新を行う
  updateCurrentView(result.total, balance);
}

// --- アクション ---

function performSearch() {
  const balance = parseInt(balanceInput.value, 10);
  if (!balance || balance < 0) {
    alert("金額を入力してください");
    return;
  }

  recalculateAndRender();

  // 検索したらバッジを消す
  clearNotification();
}

// ---------------------------------------------------------
// ▲▲▲ 修正・追加ここまで ▲▲▲
// ---------------------------------------------------------

if (searchBtn) {
  searchBtn.addEventListener("click", performSearch);
}

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

    // リセット時は updateCurrentView に 0 を渡してフッターをクリア
    updateCurrentView(0, 0);

    resultArea.innerHTML =
      '<div class="empty-state">リセットしました。<br>「提案」ボタンを押してランチを決めましょう！</div>';

    clearNotification();
  });
}

/**
 * 画面表示を更新するメインのレンダリング関数
 */
function updateCurrentView(calculatedTotal, balance) {
  calculatedTotal = calculatedTotal || 0;
  balance = balance || 0;

  // 現在開いているアコーディオンのIDを取得して保存 (リスト開閉維持のため)
  const openGroupIds = new Set();
  document.querySelectorAll(".details-container.open").forEach((el) => {
    const id = el.id.replace("details-", "");
    openGroupIds.add(id);
  });

  // currentSuggestionからユニークなグループを抽出
  const uniqueGroups = [];
  const groupIds = new Set();

  currentSuggestion.forEach((item) => {
    if (!groupIds.has(item.id)) {
      uniqueGroups.push(item);
      groupIds.add(item.id);
    }
  });

  // (注: totalの計算は recalculateAndRender で行われた total を使用する)

  renderResults(
    uniqueGroups,
    balance,
    resultArea,
    itemCounts,
    lockedGroupIds,
    calculatedTotal, // recalculateAndRenderで計算された合計金額を渡す
    openGroupIds // 開閉状態を渡す
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
  codeReader
    .decodeFromVideoDevice(null, "video", (result, err) => {
      if (result) {
        console.log("Scanned:", result.text);
        handleJanScanSuccess(result.text);
        stopScanning();
      }
    })
    .catch((err) => {
      console.error(err);
      alert(
        "カメラの起動に失敗しました。カメラへのアクセスを許可してください。"
      );
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

  // 1. カウントアップ
  const currentCount = itemCounts[scannedJan] || 0;
  itemCounts[scannedJan] = currentCount + 1;

  if (userExcludedIds.has(targetGroupId)) {
    userExcludedIds.delete(targetGroupId);
  }

  // 2. 最も重要な修正: 再計算を実行する
  recalculateAndRender(); // <--- ここで新しいリストが生成されます

  // 3. バッジをクリア
  clearNotification();
}
