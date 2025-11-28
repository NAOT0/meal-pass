// ui.js

export function renderResults(
  result,
  balance,
  resultArea,
  itemCounts,
  lockedGroupIds,
  openGroupIds = new Set()
) {
  resultArea.style.display = "block";

  if (result.suggestion.length === 0) {
    resultArea.innerHTML = `<div class="error">条件に合う候補がありません</div>`;
    return;
  }

  const diff = balance - result.total;
  let balanceDisplay =
    diff >= 0
      ? `<span style="color:var(--color-text-sub);">残高: ${diff}円</span>`
      : `<span style="color:var(--color-error); font-weight:bold;">+${Math.abs(
          diff
        )}円 超過</span>`;

  let html = `
        <div class="result-card">
            <div class="result-header">
                <h3>合計: <span class="total-price">${result.total}円</span></h3>
                ${balanceDisplay}
            </div>
            <ul class="suggestion-list">
    `;

  const displayGroups = [];
  const groupMap = new Map();

  result.suggestion.forEach((item) => {
    if (!groupMap.has(item.id)) {
      groupMap.set(item.id, { ...item, displayCount: 0, displayTotal: 0 });
      displayGroups.push(groupMap.get(item.id));
    }
    const g = groupMap.get(item.id);
    g.displayCount++;
    g.displayTotal += item.price;
  });

  displayGroups.forEach((group) => {
    const isBoosted = group.isCoop;
    const coopBadge = isBoosted
      ? `<span class="coop-badge" style="background:#c91223; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-left:8px; white-space:nowrap;">COOP</span>`
      : "";

    const isGroupLocked = lockedGroupIds.has(group.id);
    const isItemLocked = group.isItemLocked;
    const isLockedAny = isGroupLocked || isItemLocked;

    const lockIconClass = isGroupLocked ? "fa-lock" : "fa-lock-open";
    const lockBtnClass = isGroupLocked ? "color:#e67e22;" : "color:#aaa;";
    const removeBtnStyle =
      "background:none; border:1px solid #ddd; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; color:#d9534f; cursor:pointer;";

    let displayName = "";
    if (group.type === "ONIGIRI") {
      displayName = "おにぎり";
    } else if (group.isItemLocked) {
      displayName = group.lockedItemName;
    } else {
      displayName =
        group.items.length === 1 ? group.items[0].name : group.rawLabel;
    }

    let priceDisplay = `${group.displayTotal}円`;

    // 外部カウンター (ONIGIRIのみ)
    let externalCounterHtml = "";
    if (group.type === "ONIGIRI" && group.items.length > 0) {
      const targetJan = group.isItemLocked ? group.jan : group.items[0].jan;
      const currentCount = itemCounts[targetJan] || 0;

      externalCounterHtml = `
                <div class="counter-ui" onclick="event.stopPropagation()">
                    <button class="counter-btn" onclick="window.updateItemCount('${
                      group.id
                    }', '${targetJan}', -1)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <span class="counter-val" style="${
                      currentCount > 0 ? "color:#e67e22;" : ""
                    }">${currentCount}</span>
                    <button class="counter-btn" onclick="window.updateItemCount('${
                      group.id
                    }', '${targetJan}', 1)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
    }

    // ▼▼▼ 詳細リストHTML生成 (スタイル調整版) ▼▼▼
    let itemsHtml = "";
    if (group.priority === 11 || group.type === "ONIGIRI") {
      let message = "店頭でご確認ください。";
      if (group.type === "ONIGIRI") {
        message = "店頭にてお好きな種類をお選びください。";
      }
      // ★修正: 幅いっぱい(width:100%)、中央揃え、左マージン削除
      itemsHtml = `
                <div style="width: 100%; padding: 12px; margin-top: 8px; font-size: 0.85rem; color: #666; background: #f9f9f9; border-radius: 4px; text-align: center; box-sizing: border-box;">
                    <i class="fas fa-info-circle" style="margin-right: 4px;"></i> ${message}
                </div>`;

      if (group.type === "ONIGIRI") {
        itemsHtml += `
                    <div style="text-align: right; padding-top: 8px;">
                         <button onclick="window.resetGroupItemCounts('${group.id}')" style="font-size: 0.8rem; color: #666; border: none; background: none; text-decoration: underline; cursor: pointer;">
                            <i class="fas fa-undo"></i> 個数をリセット
                         </button>
                    </div>`;
      }
    } else {
      // 通常商品リスト
      itemsHtml = group.items
        .map((item) => {
          const count = itemCounts[item.jan] || 0;
          const countStyle =
            count > 0 ? "font-weight:bold; color:#e67e22;" : "color:#888;";
          // ★修正: width: 100% を追加して両端揃えを確実に
          return `
                <div style="width: 100%; padding: 8px 0; font-size: 0.9rem; border-bottom: 1px dashed #eee; display: flex; align-items: center; justify-content: space-between;">
                    <span style="flex: 1; padding-right: 8px;">${item.name}</span>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <button onclick="window.updateItemCount('${group.id}', '${item.jan}', -1)" style="width: 24px; height: 24px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">-</button>
                        <span style="${countStyle} width: 16px; text-align: center;">${count}</span>
                        <button onclick="window.updateItemCount('${group.id}', '${item.jan}', 1)" style="width: 24px; height: 24px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">+</button>
                    </div>
                </div>`;
        })
        .join("");

      itemsHtml += `
                <div style="text-align: right; padding-top: 8px;">
                     <button onclick="window.resetGroupItemCounts('${group.id}')" style="font-size: 0.8rem; color: #666; border: none; background: none; text-decoration: underline; cursor: pointer;">
                        <i class="fas fa-undo"></i> 個数をリセット
                     </button>
                </div>
            `;
    }

    const isOpen = openGroupIds.has(group.id);
    const detailsStyle = isOpen ? "max-height:1000px;" : "max-height:0;";
    const detailsClass = isOpen ? "open" : "";
    const iconTransform = isOpen ? "rotate(180deg)" : "rotate(0deg)";

    let mainContentHtml = "";
    if (group.type === "ONIGIRI") {
      mainContentHtml = `
                <div style="display:flex; flex-direction:column; justify-content:center; padding: 4px 0;">
                    <div style="display:flex; align-items:center; margin-bottom: 6px;">
                        <i class="fas ${
                          group.icon
                        }" style="margin-right:8px; color:#555;"></i>
                        <span style="font-weight:700;">${displayName}</span>
                    </div>
                    <div style="display:flex; align-items:center;">
                        ${coopBadge}
                        <div style="margin-left: ${isBoosted ? "10px" : "0"};">
                            ${externalCounterHtml}
                        </div>
                    </div>
                </div>
            `;
    } else {
      mainContentHtml = `
                <div style="display:flex; align-items:center; min-height:36px; flex-wrap: nowrap;">
                    <i class="fas ${group.icon}" style="margin-right:8px; color:#555; flex-shrink: 0;"></i>
                    <span style="font-weight:700; margin-right:8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">${displayName}</span>
                    ${coopBadge}
                    ${externalCounterHtml}
                </div>
            `;
    }

    // ★修正: 詳細エリア(details-...)の padding-left: 12px を削除し、padding-left: 0 に変更
    html += `
            <li style="${isLockedAny ? "background-color:#fff8e1;" : ""}">
                <div style="flex:1;">
                    <div style="cursor:pointer;" onclick="window.toggleDetails('${
                      group.id
                    }')">
                        ${mainContentHtml}
                    </div>
                    
                    <div id="details-${
                      group.id
                    }" class="${detailsClass}" style="${detailsStyle} overflow:hidden; transition:max-height 0.3s; margin-top:5px; padding-left: 0;">
                        ${itemsHtml}
                    </div>
                </div>
                
                <div style="display:flex; align-items:center; gap:8px; align-self: flex-start; margin-top: 8px;">
                    <span class="item-price" style="white-space:nowrap;">${priceDisplay}</span>
                    <button onclick="window.toggleGroupLock('${
                      group.id
                    }')" style="background:none; border:none; cursor:pointer; font-size:1.1rem; ${lockBtnClass}">
                        <i class="fas ${lockIconClass}"></i>
                    </button>
                    <button onclick="window.removeSlot('${
                      group.id
                    }')" style="${removeBtnStyle}">
                        <i class="fas fa-times"></i>
                    </button>
                    <i id="icon-${
                      group.id
                    }" class="fas fa-chevron-down" style="font-size:0.8rem; color:#aaa; transition:transform 0.2s; margin-left:4px; transform: ${iconTransform};"></i>
                </div>
            </li>
        `;
  });

  html += `</ul></div>`;
  resultArea.innerHTML = html;
}

export function showError(message, resultArea) {
  resultArea.innerHTML = `<div class="error">${message}</div>`;
  resultArea.style.display = "block";
}

export function toggleDetails(id) {
  const el = document.getElementById(`details-${id}`);
  const icon = document.getElementById(`icon-${id}`);
  if (el) {
    el.classList.toggle("open");
    if (el.classList.contains("open")) {
      el.style.maxHeight = "500px";
      if (icon) icon.style.transform = "rotate(180deg)";
    } else {
      el.style.maxHeight = "0";
      if (icon) icon.style.transform = "rotate(0deg)";
    }
  }
}
