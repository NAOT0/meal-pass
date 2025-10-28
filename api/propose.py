from flask import Flask, request, jsonify

# Flaskアプリのインスタンスを作成
app = Flask(__name__)

# `/api/propose` へのリクエストをこの関数で処理する
# Vercelがファイル名（propose.py）をURL（/api/propose）に対応させます


@app.route('/', methods=['GET', 'POST'])
def propose_combination():
    # TODO: 本来はここで「ナップサック問題」のアルゴリズムを動かす

    # クエリパラメータから残額を取得してみる
    # (例: .../api/propose?remaining=350)
    remaining_balance = request.args.get('remaining', default=0, type=int)

    # ダミーの提案を返す
    suggestion = {
        "remaining": remaining_balance,
        "suggestion": [
            {"name": "おにぎり", "price": 140},
            {"name": "お茶", "price": 160}
        ],
        "total": 300
    }

    # JSON形式で結果を返す

    return jsonify(suggestion)
