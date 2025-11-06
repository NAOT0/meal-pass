const balanceInput = document.getElementById("balanceInput");
const confirmButton = document.getElementById("confirmButton");

// 「確定」ボタンがクリックされた時の処理
confirmButton.addEventListener("click", async () => {
  // 1. 入力欄から値を取得
  const remainingBalance = balanceInput.value;

  // (バリデーション) もし入力が空なら、処理を中断
  if (!remainingBalance) {
    alert("残高を入力してください。"); // alertの代わりに、画面にメッセージを出すのが望ましいです
    return;
  }

  // 2. APIのURLを構築
  // (例: remainingBalanceが 350 なら、URLは "/api/propose?remaining=350" となる)
  const apiUrl = `/api/propose?remaining=${remainingBalance}`;

  try {
    // 3. APIにリクエストを送信 (fetch)
    const response = await fetch(apiUrl);

    // 4. APIから返ってきたJSONデータを取得
    const suggestion = await response.json();

    // 5. 結果をコンソールに表示 (動作確認用)
    console.log("APIからの提案:", suggestion);

    // TODO: ここで suggestion の内容をHTMLに反映させる
    // (例: alert(`提案: ${suggestion.suggestion[0].name}`));
  } catch (error) {
    // エラーハンドリング
    console.error("APIリクエスト中にエラーが発生しました:", error);
    alert("提案の取得に失敗しました。");
  }
});
