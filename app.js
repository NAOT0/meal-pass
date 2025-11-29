// app.js

import { calculateCombination } from "./logic.js";
import { renderResults, showError, toggleDetails } from "./ui.js";
import { fetchMenuData } from "./api-client.js";
// ▼▼▼ 修正後: パッケージ名をそのまま記述します ▼▼▼
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
// --- 設定 ---
const MAX_EXCLUDED_ITEMS = 5;
// logic.js側でリスト制限を行うため、この定数はここでは使用しませんが、残しておきます。
const MAX_SUGGESTIONS_TO_DISPLAY = 5;

// --- DOM要素 ---
const balanceInput = document.getElementById("balanceInput");
const searchBtn = document.getElementById("searchBtn");
const resultArea = document.getElementById("resultArea");
const resetExcludedButton = document.getElementById("resetExcludedButton");
const retrySearchBtn = document.getElementById("retrySearchBtn"); // フッターの再検索ボタン

// ▼▼▼ 追加: スキャン関連のDOM要素 ▼▼▼
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

// ▼▼▼ 追加: コードリーダーのインスタンス作成 ▼▼▼
const codeReader = new BrowserMultiFormatReader();
let activeScanControls = null;

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
    // 金額変更時は通知する
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

window.removeSlot = function (id) {
  if (lockedGroupIds.has(id)) {
    alert("ロックを解除してください。");
    return; // 削除ができないように処理を中断
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

  // リスト削除時も再検索が必要な状態として通知する
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
  // 個数変更はバッジ表示の対象外
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

  // logic.js側でランダム制限とユニーク化が行われている
  currentSuggestion = result.suggestion;
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

  // 現在開いているアコーディオンのIDを取得して保存 (リスト開閉維持のため)
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
    // 個数指定がない場合は1個として扱う（提案リストに含まれているため）
    if (!hasExplicitCount) {
      countInGroup = 1;
    }
    // group.price * countInGroupは、個数指定された商品も考慮した正しい合計価格
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

// ---------------------------------------------------------
// ▼▼▼ 追加: JANコードスキャン機能の実装 ▼▼▼
// ---------------------------------------------------------

if (scanBtn) {
  scanBtn.addEventListener("click", startScanning);
}

if (stopScanBtn) {
  stopScanBtn.addEventListener("click", stopScanning);
}

// カメラ起動とスキャン開始関数
function startScanning() {
  // UIの切り替え
  scanBtn.style.display = "none";
  scannerContainer.style.display = "block";
  // 一時的にローディング表示などしてもよいですが、UIがずれないように今回はそのまま

  // JANコード(EAN-13)などを読み取る
  codeReader
    .decodeFromVideoDevice(null, "video", (result, err) => {
      // 読み取り成功時
      if (result) {
        console.log("Found Code:", result.text);
        handleJanScanSuccess(result.text); // ★連携処理呼び出し
        stopScanning(); // 読み取れたらカメラを止める
      }
      // エラーハンドリング (読み取り待機中はNotFoundExceptionが頻発するので無視してOK)
      if (err && !(err instanceof NotFoundException)) {
        console.error(err);
      }
    })
    .then((controls) => {
      activeScanControls = controls;
    })
    .catch((err) => {
      console.error(err);
      alert(
        "カメラの起動に失敗しました。カメラへのアクセスを許可してください。"
      );
      stopScanning();
    });
}

// スキャン停止関数
function stopScanning() {
  if (activeScanControls) {
    activeScanControls.stop();
    activeScanControls = null;
  }
  scannerContainer.style.display = "none";
  scanBtn.style.display = "inline-block";
}

// 読み取ったJANコードをアプリに反映するロジック
function handleJanScanSuccess(scannedJan) {
  // 1. 全データからJANコードが一致する商品を探す
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
    alert(
      `JANコード: ${scannedJan}\nこの商品はメニューに見つかりませんでした。`
    );
    return;
  }

  // 2. カウントアップ処理 (手動で＋ボタンを押したのと同じ扱いにする)
  const currentCount = itemCounts[scannedJan] || 0;
  itemCounts[scannedJan] = currentCount + 1;

  // もし除外リストに入っていたら削除 (ユーザーが意図して選んだため)
  if (userExcludedIds.has(targetGroupId)) {
    userExcludedIds.delete(targetGroupId);
  }

  // 3. UI更新と再計算を実行
  updateCurrentView();

  // バッジなどをクリア
  clearNotification();

  // ユーザーへのフィードバック(任意)
  // alert(`${foundItem.name} を追加しました`);
}
