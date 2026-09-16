// LocalStorage Wrappers for CV Versions, Job Bookmarks, and Analysis History

const STORAGE_KEYS = {
  HISTORY: 'cvscan_history',
  BOOKMARKS: 'cvscan_bookmarks'
};

function getStorage(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Storage error:", e);
    return [];
  }
}

function setStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Storage save error:", e);
  }
}

// --- Job Bookmarks ---
function toggleBookmark(jobId, jobName, url) {
  let bookmarks = getStorage(STORAGE_KEYS.BOOKMARKS);
  const exists = bookmarks.find(b => b.id === jobId);
  
  if (exists) {
    bookmarks = bookmarks.filter(b => b.id !== jobId);
    showToast('Removed ' + jobName + ' from bookmarks');
  } else {
    bookmarks.push({ id: jobId, name: jobName, url: url, date: new Date().toISOString() });
    showToast('Bookmarked ' + jobName);
  }
  setStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
  renderBookmarks();
}

function renderBookmarks() {
  const container = document.getElementById('bookmarks-list');
  if (!container) return;
  const bookmarks = getStorage(STORAGE_KEYS.BOOKMARKS);
  
  if (bookmarks.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No bookmarked jobs yet.</p>';
    return;
  }
  
  container.innerHTML = bookmarks.map(b => `
    <div class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-2">
      <a href="${b.url}" target="_blank" class="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">${b.name}</a>
      <button onclick="toggleBookmark('${b.id}', '${b.name}', '${b.url}')" class="text-xs text-red-500 hover:text-red-700">Remove</button>
    </div>
  `).join('');
}

// --- Analysis History & CV Versions ---
function saveHistoryRecord(score, matchKw, missKw, summary) {
  const history = getStorage(STORAGE_KEYS.HISTORY);
  
  const record = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    score: score,
    matched: matchKw,
    missing: missKw,
    summary: summary,
    cvContext: typeof cvTextContent !== 'undefined' ? cvTextContent : "" // Grab global CV state safely
  };
  
  // Keep only the last 10 records
  history.unshift(record);
  if (history.length > 10) history.pop();
  
  setStorage(STORAGE_KEYS.HISTORY, history);
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;
  const history = getStorage(STORAGE_KEYS.HISTORY);
  
  if (history.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No analysis history found.</p>';
    return;
  }
  
  container.innerHTML = history.map(h => `
    <div class="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-3">
      <div class="flex justify-between items-center mb-2">
        <span class="text-xs text-gray-400">${new Date(h.date).toLocaleString()}</span>
        <span class="font-bold text-indigo-600 dark:text-indigo-400">Score: ${h.score}</span>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">${h.summary}</p>
    </div>
  `).join('');
}

// --- Mutation Observer to Safely Read Analyzer Output ---
// This observes the '#results-area' to see when it becomes visible.
// When it does, we know an analysis just finished, and we can safely save the history
// without ever touching or overriding the original `analyze()` function.
document.addEventListener('DOMContentLoaded', () => {
  const target = document.getElementById('results-area');
  if (!target) return;
  
  // Render initial state
  renderBookmarks();
  renderHistory();
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'style') {
        if (target.style.display === 'block') {
          // The results area just became visible! Capture data safely.
          try {
             const score = document.getElementById('score-val')?.innerText || "0";
             const summary = document.getElementById('score-desc')?.innerText || "";
             
             // Extract keywords from DOM safely
             const matchKw = Array.from(document.querySelectorAll('#kw-match .kw')).map(el => el.innerText);
             const missKw = Array.from(document.querySelectorAll('#kw-miss .kw')).map(el => el.innerText);
             
             saveHistoryRecord(score, matchKw, missKw, summary);
          } catch (e) {
             console.error("Safe history capture failed:", e);
          }
        }
      }
    });
  });
  
  observer.observe(target, { attributes: true });
});
