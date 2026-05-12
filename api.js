const STORE = "budg-el-v3";

// localStorage fallback — keeps data safe if the API is unavailable
export const lsLoad = () => { try { const r = localStorage.getItem(STORE); return r ? JSON.parse(r) : null; } catch { return null; } };
export const lsSave = d => { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch {} };

export const loadBudget = async () => {
  try {
    const res = await fetch("/api/budget");
    if (!res.ok) throw new Error("API error");
    const { data } = await res.json();
    return data ?? lsLoad();
  } catch {
    return lsLoad();
  }
};

export const saveBudget = async (data) => {
  lsSave(data); // always write locally first so nothing is lost
  try {
    const res = await fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error("Save failed");
  } catch (err) {
    throw err; // let the caller handle UI feedback
  }
};
