// app.js

import { calculateCombination } from "./logic.js";
import { renderResults, showError, toggleDetails } from "./ui.js";
import { fetchMenuData } from "./api-client.js";

// --- 設定 ---
const MAX_EXCLUDED_ITEMS = 5;
const MAX_SUGGESTIONS_TO_DISPLAY = 5; // ★追加: 表示する最大提案数

// --- DOM要素 ---
const balanceInput = document.getElementById("balanceInput");
const searchBtn = document.getElementById("searchBtn");
const resultArea = document.getElementById("resultArea");
const resetExcludedButton = document.getElementById("resetExcludedButton");
const retrySearchBtn = document.getElementById("retrySearchBtn");

// --- 状態 (State) ---
let menuGroups = [];
let isDataLoaded = false;
let userExcludedIds = new Set();
let itemCounts = {};
let lockedGroupIds = new Set();
let coopExcludedQueue = [];
let currentSuggestion = [];

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

  // フィルタのクリックイベント
  document.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const targetId = btn.getAttribute("data-target");
      btn.classList.toggle("active");
      const checkbox = document.getElementById(targetId);
      if (checkbox) checkbox.checked = !checkbox.checked;

      // フィルタ変更は再検索条件が変わるので通知する
      notifyChange();
    });
  });

  // 残高変更イベント
  balanceInput.addEventListener("input", () => {
    // ★金額変更時は通知する
    notifyChange();
  });
});

// --- 変更通知機能 (バッジ表示) ---
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

// app.js の window.removeSlot 関数のみを修正

window.removeSlot = function (id) {
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

  // ★修正: リスト削除時も再検索が必要な状態として通知する
  notifyChange();
};

// ... その他の関数は変更なし ...

window.toggleGroupLock = function (groupId) {
  if (lockedGroupIds.has(groupId)) {
    lockedGroupIds.delete(groupId);
  } else {
    lockedGroupIds.add(groupId);
    userExcludedIds.delete(groupId);
  }
  updateCurrentView();
  // ロック変更はバッジ表示の対象外
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
  // ★個数変更はバッジ表示の対象外
};

window.resetGroupItemCounts = function (groupId) {
  const group = menuGroups.find((g) => g.id === groupId);
  if (group) {
    group.items.forEach((item) => {
      if (itemCounts[item.jan]) {
        delete itemCounts[item.jan];
      }
    });
  }
  updateCurrentView();
  // リセットはバッジ表示の対象外
};

// --- アクション ---

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

  // ★修正: 提案リストを最大5つのユニークなグループに制限する
  const limitedSuggestion = [];
  const groupIds = new Set();

  // result.suggestion は優先順位でソートされているため、前から取るだけでOK
  for (const item of result.suggestion) {
    if (groupIds.size >= MAX_SUGGESTIONS_TO_DISPLAY) {
      break; // 5つに達したら終了
    }
    if (!groupIds.has(item.id)) {
      limitedSuggestion.push(item);
      groupIds.add(item.id);
    }
  }

  currentSuggestion = limitedSuggestion; // 5つに制限したリストを保存
  updateCurrentView();

  // 検索したらバッジを消す
  clearNotification();
}

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

  // ★現在開いているアコーディオンのIDを取得して保存
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
    if (!hasExplicitCount) {
      countInGroup = 1;
    }
    total += group.price * countInGroup;
  });

  renderResults(
    uniqueGroups,
    balance,
    resultArea,
    itemCounts,
    lockedGroupIds,
    total,
    openGroupIds // 開閉状態を渡す
  );
}
