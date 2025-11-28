import { calculateCombination } from "./logic.js";
import { renderResults, showError, toggleDetails } from "./ui.js";
import { fetchMenuData } from "./api-client.js";

// --- 設定 ---
const MAX_EXCLUDED_ITEMS = 5; // 生協商品の除外履歴保持数 (FIFO)

// --- DOM要素 ---
const balanceInput = document.getElementById("balanceInput");
const searchBtn = document.getElementById("searchBtn");
const resultArea = document.getElementById("resultArea");
const resetExcludedButton = document.getElementById("resetExcludedButton");
const filterInputs = document.querySelectorAll(".filter-checkbox input");

// --- 状態 (State) ---
let menuGroups = [];
let isDataLoaded = false;
let userExcludedIds = new Set();
let itemCounts = {}; // { "JANコード": 個数 }
let lockedGroupIds = new Set(); // 枠固定されたグループID
let coopExcludedQueue = []; // 生協商品の除外履歴 (FIFO用)

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
});

// --- グローバル関数登録 (HTMLのonclickから呼ばれる) ---

// 1. 商品の除外 (×ボタン)
window.removeSlot = function (id) {
  // 既に除外済みなら何もしない
  if (userExcludedIds.has(id)) return;

  // 削除ボタンが押されたら、そのグループの個数指定もクリアする
  // (これがないと、個数指定されたまま除外され、復活したときに個数が残ってしまう)
  if (menuGroups) {
    const group = menuGroups.find((g) => g.id === id);
    if (group) {
      group.items.forEach((item) => {
        if (itemCounts[item.jan]) delete itemCounts[item.jan];
      });
    }
  }

  // 枠固定も解除する
  if (lockedGroupIds.has(id)) lockedGroupIds.delete(id);

  const group = menuGroups.find((g) => g.id === id);
  if (!group) return;

  // 除外リストに追加
  userExcludedIds.add(id);

  // ★生協商品(COOP)の場合のみ、FIFOロジックを適用
  if (group.isCoop) {
    coopExcludedQueue.push(id);

    // 上限を超えたら、一番古い生協商品を復活させる
    if (coopExcludedQueue.length > MAX_EXCLUDED_ITEMS) {
      const oldestId = coopExcludedQueue.shift(); // 先頭（最古）を取り出し
      userExcludedIds.delete(oldestId); // 除外リストから削除（復活）
    }
  }

  runSimulation();
};

// 2. 枠の固定/解除 (南京錠ボタン)
window.toggleGroupLock = function (groupId) {
  if (lockedGroupIds.has(groupId)) {
    lockedGroupIds.delete(groupId); // 解除
  } else {
    lockedGroupIds.add(groupId); // 固定
    userExcludedIds.delete(groupId); // 固定するなら除外リストからは消す
  }
  runSimulation();
};

// 3. 商品個数の変更 (+-ボタン)
window.updateItemCount = function (groupId, jan, delta) {
  const current = itemCounts[jan] || 0;
  const next = current + delta;

  if (next < 0) return; // マイナスにはしない

  itemCounts[jan] = next;

  // 個数が1以上になったら、そのグループは自動的に提案対象にする（除外リストから削除）
  if (next > 0) {
    userExcludedIds.delete(groupId);
  }

  runSimulation();
};

// 4. グループ内の個数リセット
window.resetGroupItemCounts = function (groupId) {
  const group = menuGroups.find((g) => g.id === groupId);
  if (group) {
    group.items.forEach((item) => {
      if (itemCounts[item.jan]) {
        delete itemCounts[item.jan];
      }
    });
  }
  runSimulation();
};

// 詳細開閉関数をWindowに登録 (ui.jsからインポートしたもの)
window.toggleDetails = toggleDetails;

// --- イベントリスナー ---

// 全リセット（検索ボタン、フィルタ変更、リセットボタン）時に使用
const resetAllState = () => {
  userExcludedIds.clear();
  coopExcludedQueue = []; // FIFOキューもクリア
};

if (searchBtn) {
  searchBtn.addEventListener("click", () => {
    resetAllState();
    itemCounts = {}; // 個数指定もリセット
    lockedGroupIds.clear(); // ロックもリセット
    runSimulation();
  });
}

filterInputs.forEach((input) => {
  input.addEventListener("change", () => {
    // フィルタ変更時はリセットして再計算
    resetAllState();
    runSimulation();
  });
});

if (resetExcludedButton) {
  resetExcludedButton.addEventListener("click", () => {
    resetAllState();
    runSimulation();
    alert("除外した商品を全て戻しました");
  });
}

// --- メイン処理 (Simulation) ---
function runSimulation() {
  if (!isDataLoaded) return;

  const balance = parseInt(balanceInput.value, 10);
  if (!balance || balance < 0) {
    showError("金額を正しく入力してください", resultArea);
    return;
  }

  // フィルタ設定の取得
  const filters = {
    bento: document.getElementById("filter-bento")?.checked ?? true,
    onigiri: document.getElementById("filter-onigiri")?.checked ?? true,
    bread: document.getElementById("filter-bread")?.checked ?? true,
    cupmen: document.getElementById("filter-cupmen")?.checked ?? true,
    drink: document.getElementById("filter-drink")?.checked ?? true,
    salad: document.getElementById("filter-salad")?.checked ?? true,
  };

  // 現在開いている詳細エリアを記憶 (UI復元用)
  const openGroupIds = new Set();
  document.querySelectorAll('[id^="details-"].open').forEach((el) => {
    openGroupIds.add(el.id.replace("details-", ""));
  });

  // 1. 計算 (Logic)
  const result = calculateCombination(
    balance,
    menuGroups,
    userExcludedIds,
    filters,
    itemCounts,
    lockedGroupIds
  );

  // 2. 表示 (UI)
  renderResults(
    result,
    balance,
    resultArea,
    itemCounts,
    lockedGroupIds,
    openGroupIds
  );
}
