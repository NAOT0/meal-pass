export async function fetchMenuData() {
  try {
    const response = await fetch("/api/menu");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("Menu data loaded:", data.length);
    return data;
  } catch (e) {
    console.error("Fetch error:", e);
    return [];
  }
}
