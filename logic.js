// logic.js

export function shuffle(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function calculateCombination(
  balance,
  candidates,
  excludedIds,
  filters,
  itemCounts,
  lockedGroupIds
) {
  let currentTotal = 0;
  const suggestion = [];

  // フラグ
  let hasMain = false;
  let hasCupmen = false;
  let drinkCount = 0;
  let onigiriCount = 0;
  let saladCount = 0;

  const usedGroupIds = new Set();

  // --- STEP 1: 個数指定された商品 (最優先) ---
  Object.keys(itemCounts).forEach((jan) => {
    const count = itemCounts[jan] || 0;
    if (count > 0) {
      const targetGroup = candidates.find((g) =>
        g.items.some((i) => i.jan === jan)
      );
      if (targetGroup) {
        const targetItemName = targetGroup.items.find(
          (i) => i.jan === jan
        ).name;

        for (let i = 0; i < count; i++) {
          const lockedItem = {
            ...targetGroup,
            isItemLocked: true,
            lockedItemName: targetItemName,
            jan: jan,
          };
          suggestion.push(lockedItem);
          currentTotal += targetGroup.price;

          if (targetGroup.type === "BENTO") hasMain = true;
          if (targetGroup.type === "ONIGIRI") {
            hasMain = true;
            onigiriCount++;
          }
          if (targetGroup.type === "BREAD") hasMain = true;
          if (targetGroup.type === "CUPMEN") hasCupmen = true;
          if (targetGroup.type === "DRINK") drinkCount++;
          if (targetGroup.type === "SALAD") saladCount++;
        }
        usedGroupIds.add(targetGroup.id);
      }
    }
  });

  // --- STEP 2: 枠固定されたグループ ---
  lockedGroupIds.forEach((groupId) => {
    if (usedGroupIds.has(groupId)) return;

    const group = candidates.find((g) => g.id === groupId);
    if (group) {
      suggestion.push({ ...group, isGroupLocked: true });
      currentTotal += group.price;
      usedGroupIds.add(groupId);

      if (group.type === "BENTO") hasMain = true;
      if (group.type === "ONIGIRI") {
        hasMain = true;
        onigiriCount++;
      }
      if (group.type === "BREAD") hasMain = true;
      if (group.type === "CUPMEN") hasCupmen = true;
      if (group.type === "DRINK") drinkCount++;
      if (group.type === "SALAD") saladCount++;
    }
  });

  // --- STEP 3: ランダム選出 ---
  let pool = shuffle([...candidates]);
  pool.sort((a, b) => b.priority - a.priority);

  for (const group of pool) {
    if (usedGroupIds.has(group.id)) continue;
    if (excludedIds.has(group.id)) continue;

    if (group.type === "BENTO") {
      if (group.isCoop && group.priority === 11) {
        if (!filters.bento) continue;
      } else {
        continue;
      }
    } else if (group.type === "ONIGIRI" && !filters.onigiri) continue;
    else if (group.type === "BREAD" && !filters.bread) continue;
    else if (group.type === "CUPMEN" && !filters.cupmen) continue;
    else if (group.type === "DRINK" && !filters.drink) continue;
    else if (group.type === "SALAD" && !filters.salad) continue;

    if (currentTotal + group.price > balance) continue;

    if (hasMain && (group.type === "BENTO" || group.type === "BREAD")) continue;
    if (group.type === "CUPMEN" && hasCupmen) continue;
    if (group.type === "ONIGIRI" && onigiriCount >= 2) continue;
    if (group.type === "DRINK" && drinkCount >= 1) continue;
    if (group.type === "SALAD" && saladCount >= 2) continue;

    suggestion.push(group);
    currentTotal += group.price;
    usedGroupIds.add(group.id);

    if (group.type === "BENTO") hasMain = true;
    if (group.type === "ONIGIRI") {
      hasMain = true;
      onigiriCount++;
    }
    if (group.type === "BREAD") hasMain = true;
    if (group.type === "CUPMEN") hasCupmen = true;
    if (group.type === "DRINK") drinkCount++;
    if (group.type === "SALAD") saladCount++;

    if (currentTotal === balance) break;
  }

  // ★修正: 並び順のロジックを変更
  suggestion.sort((a, b) => {
    // 1. ロックされているもの（個数指定 or 枠固定）を最優先
    const aLocked = a.isItemLocked || a.isGroupLocked;
    const bLocked = b.isItemLocked || b.isGroupLocked;

    if (aLocked && !bLocked) return -1; // aが上
    if (!aLocked && bLocked) return 1; // bが上

    // 2. それ以外は優先度順
    if (b.priority !== a.priority) return b.priority - a.priority;
    // 3. 最後はID順
    return b.id.localeCompare(a.id);
  });

  return { suggestion, total: currentTotal, remaining: balance - currentTotal };
}
