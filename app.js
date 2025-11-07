const balanceInput = document.getElementById("balanceInput");
const confirmButton = document.getElementById("confirmButton");
const resultArea = document.getElementById("resultArea");
// 「確定」ボタンがクリックされた時の処理
confirmButton.addEventListener("click", async () => {
  const remainingBalance = balanceInput.value;

  const apiUrl = `/api/propose?remaining=${remainingBalance}`;
  resultArea.innerHTML = '<p class="loading">提案を検索中...</p>';
  resultArea.style.display = "block"; // エリアを表示
  try {
    if (!remainingBalance) {
      resultArea.innerHTML = '<p class="error">残高を入力してください</p>';
      return;
    }
    const response = await fetch(apiUrl);

    const suggestion = await response.json();
    const itemsHtml = suggestion.suggestion
      .map((item) => {
        return `<li>${item.name} (${item.price}円)</li>`;
      })
      .join(""); // join('') で配列を一つの文字列に

    // 結果エリアに表示するHTMLを構築
    resultArea.innerHTML = `
            <h3>おすすめの組み合わせ (合計: ${suggestion.total}円)</h3>
            <ul class="suggestion-list">
                ${itemsHtml}
            </ul>
            <p>（購入後の残高: ${
              suggestion.remaining - suggestion.total
            }円）</p>
        `;
    console.log("APIからの提案:", suggestion);
  } catch (error) {
    // エラーハンドリング
    console.error("APIリクエスト中にエラーが発生しました:", error);
    resultArea.innerHTML = '<p class="error">提案の取得に失敗しました。</p>';
  }
});
