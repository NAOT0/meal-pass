// ui.js

// シャッフル関数 (詳細アイテム用)
function shuffle(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function renderResults(
  suggestionList,
  balance,
  resultArea,
  itemCounts,
  lockedGroupIds,
  calculatedTotal,
  openGroupIds = new Set(),
  scannedJanCodes = new Set() // 追加: スキャン済みリスト
) {
  const footerTotal = document.getElementById("footerTotal");
  const footerRemain = document.getElementById("footerRemain");
  const footerStatus = document.getElementById("footerStatus");

  // --- フッター更新 ---
  footerTotal.textContent = `¥ ${calculatedTotal.toLocaleString()}`;
  const remain = balance - calculatedTotal;
  footerRemain.textContent = `¥ ${remain.toLocaleString()}`;

  if (remain < 0) {
    footerRemain.className = "value";
    footerStatus.innerHTML = `<span class="badge-status">予算オーバー！</span>`;
  } else {
    footerRemain.className = "value safe";
    footerStatus.innerHTML = "";
  }

  // --- リスト描画 ---
  if (!suggestionList || suggestionList.length === 0) {
    resultArea.innerHTML = `<div class="empty-state">選択された商品はありません</div>`;
    return;
  }

  let html = "";

  suggestionList.forEach((group) => {
    const isLocked = lockedGroupIds.has(group.id);
    const iconClass = group.icon ? `fas ${group.icon}` : "fas fa-utensils";
    const coopBadge = group.isCoop
      ? `<span class="badge-coop">COOP</span>`
      : "";

    const isOpen = openGroupIds.has(group.id);
    const detailsClass = isOpen
      ? "details-container open"
      : "details-container";

    const itemIconContent =
      group.type === "ONIGIRI" ? "🍙" : `<i class="${iconClass}"></i>`;

    // ---------------------------------------------------------------
    // ▼▼▼ 名前決定ロジック (スキャン判定あり) ▼▼▼
    // ---------------------------------------------------------------
    let displayName = group.name || "";

    // カウントが1以上の商品を取得
    const activeItems = group.items
      ? group.items.filter((i) => (itemCounts[i.jan] || 0) > 0)
      : [];

    if (activeItems.length > 0) {
      // 条件: 1種類だけ選ばれている AND その商品がスキャン経由である
      const isScannedItem =
        activeItems.length === 1 && scannedJanCodes.has(activeItems[0].jan);

      if (isScannedItem) {
        // スキャンされた商品なら具体的な名前を表示
        displayName = activeItems[0].name;
      } else {
        // 手動選択、または複数種類混ざっている場合はグループ名
        if (group.type === "ONIGIRI") displayName = "おにぎり";
        if (!displayName) displayName = `${group.items[0].name} 他`;
      }
    } else {
      // 提案（ランダム表示）の場合
      if (group.type === "ONIGIRI") {
        displayName = "おにぎり";
      } else if (!displayName) {
        if (group.items && group.items.length === 1) {
          displayName = group.items[0].name;
        } else if (group.rawLabel) {
          displayName = group.rawLabel;
        } else {
          displayName = "商品名なし";
        }
      }
    }
    // ---------------------------------------------------------------

    // 個数計算
    let totalCountInGroup = 0;
    if (group.items) {
      group.items.forEach((i) => {
        totalCountInGroup += itemCounts[i.jan] || 0;
      });
    }
    if (totalCountInGroup === 0) totalCountInGroup = 1;

    let priceDisplayHtml = `<div class="card-item-price">¥${group.price}</div>`;

    if (totalCountInGroup > 1 || isLocked) {
      const itemTotal = group.price * totalCountInGroup;
      priceDisplayHtml = `
          <div class="card-item-price" style="color:#555; font-weight:400; font-size:0.8rem;">単価: ¥${group.price}</div>
          <div class="card-item-price">合計: ¥${itemTotal}</div>
        `;
    } else if (totalCountInGroup === 1) {
      priceDisplayHtml = `<div class="card-item-price">¥${group.price}</div>`;
    }

    let detailsHtml = "";
    let hasDetails = false;

    if (group.type === "ONIGIRI") {
      hasDetails = true;
      detailsHtml = `
        <div class="detail-message">
          <i class="fas fa-info-circle"></i> 店頭にてお好きな種類をお選びください。
        </div>
        <div class="detail-actions">
           <button class="text-btn" onclick="window.resetGroupItemCounts('${group.id}')">
             <i class="fas fa-undo"></i> 個数をリセット
           </button>
        </div>
      `;
    } else if (group.type === "BENTO") {
      hasDetails = true;
      detailsHtml = `
            <div class="detail-message">
              <i class="fas fa-info-circle"></i> 種類は店頭で選んでください。
            </div>
        `;
    } else if (group.items && group.items.length > 0) {
      hasDetails = true;
      let itemsToDisplay = group.items;
      if (group.items.length > 5) {
        itemsToDisplay = shuffle(group.items).slice(0, 5);
      }

      const itemsRows = itemsToDisplay
        .map((item) => {
          const count = itemCounts[item.jan] || 0;
          return `
          <div class="detail-row">
            <div class="detail-name">${item.name}</div>
            <div class="detail-counter">
               <button class="btn-count-small" onclick="window.updateItemCount('${group.id}', '${item.jan}', -1)">-</button>
               <span class="count-val-small">${count}</span>
               <button class="btn-count-small" onclick="window.updateItemCount('${group.id}', '${item.jan}', 1)">+</button>
            </div>
          </div>
        `;
        })
        .join("");

      detailsHtml = `
        <div class="detail-list">${itemsRows}</div>
        <div class="detail-actions">
           <button class="text-btn" onclick="window.resetGroupItemCounts('${group.id}')">
             <i class="fas fa-undo"></i> 個数をリセット
           </button>
        </div>
      `;
    }

    const mainTargetJan =
      group.items && group.items.length > 0 ? group.items[0].jan : "";

    const chevronStyle = isOpen ? 'style="transform: rotate(180deg);"' : "";
    const chevronHtml = hasDetails
      ? `<i class="fas fa-chevron-down chevron-icon" id="chevron-${group.id}" ${chevronStyle}></i>`
      : ``;

    const isRemoveDisabled = isLocked ? "disabled-action" : "";

    html += `
      <div class="item-card-wrapper">
        <div class="item-card ${
          isLocked ? "locked" : ""
        }" onclick="window.toggleDetails('${group.id}')">
          <div class="card-left">
            <div class="item-icon-box">
              ${itemIconContent}
              ${coopBadge}
            </div>
            <div class="item-details">
              <div class="card-item-name">${displayName}</div>
              ${priceDisplayHtml}
            </div>
          </div>
          <div class="card-right">
            <div class="counter-box" onclick="event.stopPropagation()">
              <button class="btn-count" onclick="window.updateItemCount('${
                group.id
              }', '${mainTargetJan}', -1)">
                <i class="fas fa-minus"></i>
              </button>
              <div class="count-val">${totalCountInGroup}</div>
              <button class="btn-count" onclick="window.updateItemCount('${
                group.id
              }', '${mainTargetJan}', 1)">
                <i class="fas fa-plus"></i>
              </button>
            </div>
            <div class="action-actions" onclick="event.stopPropagation()">
              <button class="btn-icon-small ${
                isLocked ? "active-lock" : ""
              }" onclick="window.toggleGroupLock('${group.id}')">
                <i class="fas ${isLocked ? "fa-lock" : "fa-lock-open"}"></i>
              </button>
              <button class="btn-icon-small remove-btn ${isRemoveDisabled}" onclick="window.removeSlot('${
      group.id
    }')">
                <i class="fas fa-times"></i>
              </button>
            </div>
            ${chevronHtml}
          </div>
        </div>
        <div id="details-${group.id}" class="${detailsClass}">
            <div class="details-inner">${detailsHtml}</div>
        </div>
      </div>
    `;
  });

  resultArea.innerHTML = html;

  if (openGroupIds.size > 0) {
    openGroupIds.forEach((id) => {
      const el = document.getElementById(`details-${id}`);
      if (el) {
        el.style.maxHeight = el.scrollHeight + "px";
      }
    });
  }
}

export function toggleDetails(id) {
  const el = document.getElementById(`details-${id}`);
  const chevron = document.getElementById(`chevron-${id}`);
  if (el) {
    el.classList.toggle("open");
    if (el.classList.contains("open")) {
      el.style.maxHeight = el.scrollHeight + "px";
      if (chevron) chevron.style.transform = "rotate(180deg)";
    } else {
      el.style.maxHeight = "0";
      if (chevron) chevron.style.transform = "rotate(0deg)";
    }
  }
}

export function showError(message, resultArea) {
  resultArea.innerHTML = `<div class="error">${message}</div>`;
}
