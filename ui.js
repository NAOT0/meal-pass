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
    const coopBadge = isBoosted ? `<span class="badge-coop">COOP</span>` : "";

    const isGroupLocked = lockedGroupIds.has(group.id);
    const isItemLocked = group.isItemLocked;
    const isLockedAny = isGroupLocked || isItemLocked;

    const lockIconClass = isGroupLocked ? "fa-lock" : "fa-lock-open";
    const lockBtnStateClass = isGroupLocked ? "locked" : "unlocked";

    let displayName = "";
    if (group.type === "ONIGIRI") displayName = "おにぎり";
    else if (group.isItemLocked) displayName = group.lockedItemName;
    else
      displayName =
        group.items.length === 1 ? group.items[0].name : group.rawLabel;

    let priceDisplay = `${group.displayTotal}円`;

    // 外部カウンター (ONIGIRIのみ)
    let externalCounterHtml = "";
    const isExternalCounter =
      group.type === "ONIGIRI" && group.items.length > 0;

    if (isExternalCounter) {
      const targetJan = group.isItemLocked ? group.jan : group.items[0].jan;
      const currentCount = itemCounts[targetJan] || 0;
      const activeClass = currentCount > 0 ? "active" : "";

      externalCounterHtml = `
                <div class="counter-ui" onclick="event.stopPropagation()">
                    <button class="counter-btn" onclick="window.updateItemCount('${group.id}', '${targetJan}', -1)"><i class="fas fa-minus"></i></button>
                    <span class="counter-val ${activeClass}">${currentCount}</span>
                    <button class="counter-btn" onclick="window.updateItemCount('${group.id}', '${targetJan}', 1)"><i class="fas fa-plus"></i></button>
                </div>
            `;
    }

    // 詳細エリアHTML生成
    let itemsHtml = "";
    if (group.priority === 11 || group.type === "ONIGIRI") {
      let message = "店頭でご確認ください。";
      if (group.type === "ONIGIRI")
        message = "店頭にてお好きな種類をお選びください。";

      itemsHtml = `
                <div class="details-message">
                    <i class="fas fa-info-circle"></i> ${message}
                </div>`;

      if (group.type === "ONIGIRI") {
        itemsHtml += `
                    <div class="details-reset-container">
                         <button class="details-reset-btn" onclick="window.resetGroupItemCounts('${group.id}')">
                            <i class="fas fa-undo"></i> 個数をリセット
                         </button>
                    </div>`;
      }
    } else {
      itemsHtml = group.items
        .map((item) => {
          const count = itemCounts[item.jan] || 0;
          const activeClass = count > 0 ? "active" : "";

          return `
                <div class="details-item-row">
                    <div class="details-item-name">${item.name}</div>
                    <div class="details-counter-wrapper">
                        <button class="counter-btn" onclick="window.updateItemCount('${group.id}', '${item.jan}', -1)"><i class="fas fa-minus"></i></button>
                        <span class="counter-val ${activeClass}">${count}</span>
                        <button class="counter-btn" onclick="window.updateItemCount('${group.id}', '${item.jan}', 1)"><i class="fas fa-plus"></i></button>
                    </div>
                </div>`;
        })
        .join("");

      itemsHtml += `
                <div class="details-reset-container">
                     <button class="details-reset-btn" onclick="window.resetGroupItemCounts('${group.id}')">
                        <i class="fas fa-undo"></i> 個数をリセット
                     </button>
                </div>`;
    }

    const isOpen = openGroupIds.has(group.id);
    const detailsStyle = isOpen ? "max-height:5000px;" : "max-height:0;";
    const detailsClass = isOpen ? "open" : "";
    const iconTransform = isOpen ? "rotate(180deg)" : "rotate(0deg)";

    // メインコンテンツのレイアウト切り替え
    let mainContentHtml = "";

    if (group.type === "ONIGIRI") {
      // ★おにぎり（2行表示）
      mainContentHtml = `
                <div class="item-header-container-col">
                    <div class="item-header-row-primary">
                        <div class="item-info-group">
                            <i class="fas ${group.icon} item-icon"></i>
                            <span class="item-name">${displayName}</span>
                            ${coopBadge}
                        </div>
                    </div>
                    <div class="item-header-row-secondary">
                        ${externalCounterHtml}
                    </div>
                </div>
            `;
    } else {
      // ★通常商品（1行表示）
      mainContentHtml = `
                <div class="item-header-container-row">
                    <div class="item-info-group">
                        <i class="fas ${group.icon} item-icon"></i>
                        <span class="item-name">${displayName}</span>
                        ${coopBadge}
                    </div>
                    <div class="item-counter-group">
                        ${externalCounterHtml}
                    </div>
                </div>
            `;
    }

    html += `
            <li style="${isLockedAny ? "background-color:#fff8e1;" : ""}">
                <div class="item-main-content">
                    <div style="cursor:pointer;" onclick="window.toggleDetails('${
                      group.id
                    }')">
                        ${mainContentHtml}
                    </div>
                    
                    <div id="details-${
                      group.id
                    }" class="details-container ${detailsClass}" style="${detailsStyle}">
                        ${itemsHtml}
                    </div>
                </div>
                
                <div class="item-actions">
                    <span class="item-price">${priceDisplay}</span>
                    <button class="btn-circle btn-lock ${lockBtnStateClass}" onclick="window.toggleGroupLock('${
      group.id
    }')">
                        <i class="fas ${lockIconClass}"></i>
                    </button>
                    <button class="btn-circle btn-remove" onclick="window.removeSlot('${
                      group.id
                    }')">
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
      el.style.maxHeight = el.scrollHeight + "px";
      if (icon) icon.style.transform = "rotate(180deg)";
    } else {
      el.style.maxHeight = "0";
      if (icon) icon.style.transform = "rotate(0deg)";
    }
  }
}
