import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  writeBatch,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

// --- 1. Firebase設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyAAQeGevVX9_xQX2Rzht8BUIGl6sYyVd34",
  authDomain: "meal-pass-app.firebaseapp.com",
  projectId: "meal-pass-app",
  storageBucket: "meal-pass-app.firebasestorage.app",
  messagingSenderId: "788392225931",
  appId: "1:788392225931:web:a8b5926331a4d0ba4a388e",
  measurementId: "G-6131GEJZRE",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// コレクション参照 (新しいコレクション 'menu_groups' を使用)
const menuGroupsCollection = collection(db, "menu_groups");

// --- 2. HTML要素の取得 ---
const csvFileInput = document.getElementById("csvFileInput");
const csvUploadButton = document.getElementById("csvUploadButton");
const uploadStatus = document.getElementById("uploadStatus");
const itemsListContainer = document.getElementById("itemsListContainer");

// --- 3. 定数定義 (Untitled-1.htmlより移植) ---
const COOP_KEYWORDS = ["大学生協", "T)", "Ｔ)", "生協", "コープ", "ＣＯ"];
const EXCLUDE_KEYWORDS = [
  "ティーバッグ",
  "スティック",
  "粉",
  "業務用",
  "瓶",
  "袋",
  "箱",
  "使用不可",
  "0701 嗜好品",
  "調整用",
  "企画",
  "三重県あおさのり",
  "あおさのり",
  "栄養士",
  "レトルト",
  "インスタント",
  "簡単調理",
  "の素",
  "寿司",
  "鮨",
  "サラダ油",
];
const ALLOWED_HIGH_PRICE_KEYWORDS = [
  "弁当",
  "丼",
  "重",
  "カレー",
  "デザート",
  "プリン",
  "ゼリー",
  "シュー",
  "ケーキ",
  "サラダ",
];
const CATEGORY_RULES = [
  {
    type: "CUPMEN",
    keywords: [
      "ヌードル",
      "ラーメン",
      "麺",
      "うどん",
      "そば",
      "パスタ",
      "焼そば",
      "焼きそば",
    ],
  },
  { type: "BENTO", keywords: ["弁当", "丼", "寿司", "重", "カレー"] },
  { type: "ONIGIRI", keywords: ["おにぎり", "おむすび"] },
  { type: "SALAD", keywords: ["サラダ"] },
  { type: "BREAD", keywords: ["パン", "サンド", "バーガー"] },
  { type: "DRINK", keywords: ["飲料", "コーヒー", "紅茶", "お茶", "水"] },
  {
    type: "SNACK",
    keywords: [
      "デザート",
      "プリン",
      "ゼリー",
      "シュー",
      "ケーキ",
      "菓子",
      "チョコ",
      "クッキー",
    ],
  },
];
const INTERNAL_GROUP_CODES = ["64"];
const INTERNAL_DEPT_CODES = ["63"];
const INTERNAL_KEYWORDS = ["内製"];

// --- 4. CSV解析ロジック (Untitled-1.htmlより移植) ---
function parseAndGroupCSV(csvText) {
  const lines = csvText.split(/\r?\n/);
  const groups = {};

  lines.forEach((line, index) => {
    if (index === 0 || !line.trim()) return;

    const cols = line.split(",");
    // データが壊れている行をスキップ
    if (cols.length < 5) return;

    const jan = cols[0] || "";
    const categoryRaw = cols[1] || "";
    const departmentRaw = cols[2] || "";
    const nameRaw = cols[3] || "";
    const priceStr = cols[5] || "0";
    const price = parseInt(priceStr, 10);
    const externalDeptCode = cols[11] || "";
    const externalGroupCode = cols[13] || "";

    const cleanName = nameRaw.replace(/ＣＯ）|CO\)/g, "").trim();

    // 内製判定
    let isMetadataInternal = false;
    if (
      INTERNAL_GROUP_CODES.includes(externalGroupCode) ||
      INTERNAL_DEPT_CODES.includes(externalDeptCode) ||
      INTERNAL_KEYWORDS.some(
        (k) => categoryRaw.includes(k) || departmentRaw.includes(k)
      )
    ) {
      isMetadataInternal = true;
    }

    // 除外判定
    if (!isMetadataInternal) {
      if (
        price <= 0 ||
        price >= 900 ||
        !jan.startsWith("4") ||
        EXCLUDE_KEYWORDS.some((kw) => nameRaw.includes(kw))
      )
        return;
    } else {
      if (
        price <= 0 ||
        price >= 900 ||
        EXCLUDE_KEYWORDS.some((kw) => nameRaw.includes(kw))
      )
        return;
    }
    if (nameRaw.includes("重") && !nameRaw.includes("三重")) return;
    if (
      nameRaw.includes("カレー") &&
      !nameRaw.includes("コープヌードル") &&
      !isMetadataInternal
    )
      return;
    if (
      price > 250 &&
      (categoryRaw.includes("飲料") || categoryRaw.includes("嗜好品"))
    )
      return;

    // カテゴリ判定
    let type = "SNACK";
    let label = categoryRaw.replace(/^\d+\s+/, "") || "その他";
    let filterKey = null;
    let icon = "fa-box";

    for (const rule of CATEGORY_RULES) {
      if (
        rule.keywords.some(
          (k) => categoryRaw.includes(k) || nameRaw.includes(k)
        )
      ) {
        type = rule.type;
        break;
      }
    }
    if (isMetadataInternal) type = "BENTO";

    // 価格ルール
    if (type === "BENTO" && price < 400) return;
    if (type === "ONIGIRI" && price >= 300) return;
    if (price > 300) {
      const isAllowed = ALLOWED_HIGH_PRICE_KEYWORDS.some((kw) =>
        nameRaw.includes(kw)
      );
      if (!isAllowed && type !== "BENTO") return;
    }

    // UI用設定
    if (type === "BENTO") {
      label = "お弁当";
      filterKey = "bento";
      icon = "fa-utensils";
    } else if (type === "ONIGIRI") {
      label = "おにぎり";
      filterKey = "onigiri";
      icon = "fa-rice-cracker";
    } else if (type === "CUPMEN") {
      label = "カップ麺";
      filterKey = "cupmen";
      icon = "fa-bowl-rice";
    } else if (type === "SALAD") {
      label = "サラダ";
      filterKey = "salad";
      icon = "fa-leaf";
    } else if (type === "BREAD") {
      label = "パン類";
      filterKey = "bread";
      icon = "fa-bread-slice";
    } else if (type === "DRINK") {
      label = "飲み物";
      filterKey = "drink";
      icon = "fa-bottle-water";
    }

    let isCoop = false;
    let isInternalBento = isMetadataInternal;
    if (isInternalBento || COOP_KEYWORDS.some((kw) => nameRaw.includes(kw)))
      isCoop = true;

    // 優先度設定
    let priority = 4;
    if (isCoop) {
      if (isInternalBento) {
        priority = 11;
        label = "内製弁当";
      } else if (type === "ONIGIRI") priority = 10;
      else if (type === "SALAD") priority = 9;
      else if (type === "CUPMEN") priority = 7;
      else if (type === "BREAD") priority = 7;
      else if (type === "DRINK") priority = 6;
    } else {
      if (type === "BENTO") priority = 8;
      else if (type === "ONIGIRI") priority = 6;
      else if (type === "SALAD") priority = 4;
      else if (type === "CUPMEN") priority = 5;
      else if (type === "BREAD") priority = 7;
      else if (type === "DRINK") priority = 6;
    }
    if (price <= 60) {
      priority = 3; // 優先度は低いまま（隙間埋め用として機能させる）
      type = "SNACK"; // タイプをおやつに統一
      label = "おやつ"; // 表示名を「調整用」から「おやつ」に変更
      icon = "fa-cookie"; // アイコンをおやつと同じクッキーに変更
    }

    // グループ生成
    const coopSuffix = isCoop ? "_COOP" : "";
    const groupId = `${type}_${filterKey || "other"}_${price}${coopSuffix}`;

    if (!groups[groupId]) {
      groups[groupId] = {
        id: groupId,
        type,
        filterKey,
        label: `${label} (${price}円)`,
        rawLabel: label,
        price,
        priority,
        icon,
        isCoop,
        items: [],
      };
    }
    groups[groupId].items.push({ name: cleanName, jan });
  });

  // アイテムが1つしかない場合のラベル調整
  Object.values(groups).forEach((g) => {
    if (g.items.length === 1) g.rawLabel = g.items[0].name;
  });

  return Object.values(groups);
}

// --- 5. Firebaseへの一括保存ロジック ---
csvUploadButton.addEventListener("click", async () => {
  const file = csvFileInput.files[0];
  if (!file) {
    alert("CSVファイルを選択してください");
    return;
  }

  uploadStatus.textContent = "CSVを解析中...";
  uploadStatus.style.color = "blue";

  try {
    const text = await file.text();
    const groups = parseAndGroupCSV(text);

    if (groups.length === 0) {
      uploadStatus.textContent = "有効なデータが見つかりませんでした。";
      uploadStatus.style.color = "red";
      return;
    }

    uploadStatus.textContent = `${groups.length}件のグループデータを登録中...`;

    // バッチ書き込み (500件制限に対応するため分割処理)
    const CHUNK_SIZE = 400; // 安全マージンをとって400
    for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
      const chunk = groups.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((group) => {
        const docRef = doc(db, "menu_groups", group.id);
        batch.set(docRef, group);
      });

      await batch.commit();
      console.log(`Chunk ${i} to ${i + chunk.length} committed.`);
    }

    uploadStatus.textContent = "更新完了！データベースが更新されました。";
    uploadStatus.style.color = "green";
    csvFileInput.value = ""; // 入力をクリア
  } catch (e) {
    console.error("Error:", e);
    uploadStatus.textContent = "エラーが発生しました: " + e.message;
    uploadStatus.style.color = "red";
  }
});

// --- 6. データのリアルタイム表示 (確認用) ---
// collection(db, "menu_groups") を監視
onSnapshot(menuGroupsCollection, (snapshot) => {
  itemsListContainer.innerHTML = "";
  snapshot.forEach((doc) => {
    const item = doc.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${item.id}</td>
        <td>${item.label}</td>
        <td>${item.price}円</td>
        <td>${item.priority}</td>
        <td>${item.items.length}</td>
    `;
    itemsListContainer.appendChild(tr);
  });
});
