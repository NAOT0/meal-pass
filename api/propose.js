// Vercelが自動的にNode.jsサーバーレス関数として扱います。

// Vercelはデフォルトで (req, res) を受け取る関数を期待します
export default function handler(req, res) {
  // PythonのFlaskコードにあったロジックを再現します

  // GETリクエスト以外はエラーを返す (もしGET専用にする場合)
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // クエリパラメータから残額を取得
  // (例: .../api/propose?remaining=350)
  // Pythonの request.args.get('remaining', default=0, type=int) とほぼ同等です
  const remaining_balance = parseInt(req.query.remaining || "0", 10);

  // ダミーの提案データ
  const suggestion = {
    remaining: remaining_balance,
    suggestion: [
      { name: "おにぎり", price: 140 },
      { name: "お茶", price: 160 },
    ],
    total: 300,
  };

  // JSON形式で結果を返す
  // ステータス200（OK）でJSONを送信します
  res.status(200).json(suggestion);
}
