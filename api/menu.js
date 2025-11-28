import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

export default async function handler(req, res) {
  // 1時間キャッシュ、裏で更新(24時間)
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400"
  );

  try {
    const snapshot = await getDocs(collection(db, "menu_groups"));
    const groups = snapshot.docs.map((doc) => doc.data());
    res.status(200).json(groups);
  } catch (error) {
    console.error("Firestore Error:", error);
    res.status(500).json({ error: "Failed to fetch menu data" });
  }
}
