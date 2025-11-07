// 1. Firebaseの関数をインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

try {
  // 2. あなたのFirebaseプロジェクト設定をここに貼り付けます
  // (Firebaseコンソールの「プロジェクトの設定」>「ウェブアプリ」で確認できます)
  const firebaseConfig = {
    apiKey: "AIzaSyAAQeGevVX9_xQX2Rzht8BUIGl6sYyVd34",
    authDomain: "meal-pass-app.firebaseapp.com",
    projectId: "meal-pass-app",
    storageBucket: "meal-pass-app.firebasestorage.app",
    messagingSenderId: "788392225931",
    appId: "1:788392225931:web:a8b5926331a4d0ba4a388e",
    measurementId: "G-6131GEJZRE",
  };

  // 3. Firebaseの初期化
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // 4. "items" コレクションへの参照を定義
  const itemsCollection = collection(db, "items");

  // 5. HTML要素の取得
  const addButton = document.getElementById("addButton");
  const itemName = document.getElementById("itemName");
  const itemPrice = document.getElementById("itemPrice");
  const itemJan = document.getElementById("itemJan"); // JANコード入力欄

  // (重要) <tbody id="itemsListContainer"> を取得
  const itemsListContainer = document.getElementById("itemsListContainer");

  // 6. 「追加」ボタンがクリックされた時の処理
  addButton.addEventListener("click", async () => {
    const name = itemName.value;
    const price = parseInt(itemPrice.value, 10);
    const jan = itemJan.value || ""; // JANコード (空の場合は空文字)

    // 入力チェック
    if (name && !isNaN(price)) {
      try {
        // Firestoreにデータを追加 (janも追加)
        await addDoc(itemsCollection, {
          name: name,
          price: price,
          jan: jan,
        });

        // 入力欄をクリア
        itemName.value = "";
        itemPrice.value = "";
        itemJan.value = "";
      } catch (e) {
        console.error("Error adding document: ", e);
      }
    } else {
      alert("商品名と価格を正しく入力してください。");
    }
  });

  // 7. データベースの変更をリアルタイムで監視 (onSnapshot)
  onSnapshot(itemsCollection, (snapshot) => {
    // まずテーブルの中身(tbody)を空にする
    itemsListContainer.innerHTML = "";

    // データベースの各ドキュメント（商品）について処理
    snapshot.forEach((doc) => {
      const item = doc.data();
      const docId = doc.id; // ドキュメントのID (削除時に必要)

      // (A) リスト(li)ではなく、テーブルの行(tr)を作成
      const tr = document.createElement("tr");
      tr.className = "product-item-row"; // CSS用にクラスを設定

      // (B) <span>ではなく、テーブルのセル(td)でデータを表示
      tr.innerHTML = `
                <td>${item.jan || "N/A"}</td>
                <td>${item.name}</td>
                <td>${item.price}</td>
                <td><button class="delete-button" data-id="${docId}">削除</button></td>
            `;

      // 削除ボタンにクリックイベントを追加
      tr.querySelector(".delete-button").addEventListener(
        "click",
        async (e) => {
          const idToDelete = e.target.dataset.id;
          await deleteDocument(idToDelete);
        }
      );

      // (C) <tbody> に <tr> を追加
      itemsListContainer.appendChild(tr);
    });
  });

  // 8. 削除機能
  async function deleteDocument(id) {
    try {
      const docRef = doc(db, "items", id); // 削除するドキュメントへの参照
      await deleteDoc(docRef);
    } catch (e) {
      console.error("Error deleting document: ", e);
    }
  }
} catch (e) {
  console.error("Firebase initialization error: ", e);
  // (重要) configが間違っていると、ここでエラーが出ます
  alert(
    "Firebaseの初期化に失敗しました。firebaseConfigが正しいか確認してください。"
  );
}
