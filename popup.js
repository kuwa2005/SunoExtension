// Popup Script

document.addEventListener('DOMContentLoaded', () => {
  initializeTabs();
  loadSongs();
  loadUrls();
  setupEventListeners();
});

// タブ機能
function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;

      // すべてのタブを非アクティブに
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // 選択されたタブをアクティブに
      button.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');

      // タブに応じてデータを再読み込み
      if (targetTab === 'songs') {
        loadSongs();
      } else if (targetTab === 'urls') {
        loadUrls();
      }
    });
  });
}

// イベントリスナーの設定
function setupEventListeners() {
  // 現在のページを保存
  document.getElementById('save-current-page').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'extractSongData' }, (response) => {
        if (chrome.runtime.lastError) {
          alert('SunoAIのページで実行してください');
          return;
        }
        if (response && response.success) {
          chrome.runtime.sendMessage({
            action: 'saveSongData',
            data: response.data
          }, (result) => {
            if (result && result.success) {
              loadSongs();
              showNotification('楽曲情報を保存しました');
            }
          });
        }
      });
    });
  });

  // 楽曲リストを更新
  document.getElementById('refresh-songs').addEventListener('click', () => {
    loadSongs();
  });

  // URLを取得
  document.getElementById('get-all-urls').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getAllUrls' }, (response) => {
        if (chrome.runtime.lastError) {
          alert('SunoAIのページで実行してください');
          return;
        }
        if (response && response.success) {
          chrome.runtime.sendMessage({
            action: 'saveUrls',
            urls: response.urls
          }, () => {
            loadUrls();
            showNotification(`${response.urls.length}個のURLを取得しました`);
          });
        }
      });
    });
  });

  // URLをエクスポート
  document.getElementById('export-urls').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getAllUrls' }, (response) => {
      if (response && response.success) {
        const data = {
          urls: response.urls,
          exportedAt: new Date().toISOString()
        };
        downloadJSON(data, `suno-urls-${new Date().toISOString().split('T')[0]}.json`);
      }
    });
  });

  // 全データをエクスポート
  document.getElementById('export-all-data').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getAllSongs' }, (songsResponse) => {
      chrome.runtime.sendMessage({ action: 'getAllUrls' }, (urlsResponse) => {
        const data = {
          songs: songsResponse.songs || [],
          urls: urlsResponse.urls || [],
          exportedAt: new Date().toISOString()
        };
        downloadJSON(data, `suno-all-data-${new Date().toISOString().split('T')[0]}.json`);
      });
    });
  });

  // 全データを削除
  document.getElementById('clear-all-data').addEventListener('click', () => {
    if (confirm('本当に全データを削除しますか？この操作は取り消せません。')) {
      chrome.storage.local.clear(() => {
        loadSongs();
        loadUrls();
        showNotification('全データを削除しました');
      });
    }
  });
}

// 楽曲リストを読み込み
function loadSongs() {
  chrome.runtime.sendMessage({ action: 'getAllSongs' }, (response) => {
    const songsList = document.getElementById('songs-list');
    
    if (!response || !response.success) {
      songsList.innerHTML = '<p class="empty">エラーが発生しました</p>';
      return;
    }

    const songs = response.songs || [];

    if (songs.length === 0) {
      songsList.innerHTML = '<p class="empty">保存済みの楽曲がありません</p>';
      return;
    }

    songsList.innerHTML = songs.map(song => createSongItem(song)).join('');
    
    // 削除ボタンのイベントリスナーを追加
    songsList.querySelectorAll('.delete-song').forEach(button => {
      button.addEventListener('click', (e) => {
        const url = e.target.dataset.url;
        deleteSong(url);
      });
    });

    // コピーボタンのイベントリスナーを追加
    songsList.querySelectorAll('.copy-song').forEach(button => {
      button.addEventListener('click', (e) => {
        const url = e.target.dataset.url;
        copySongData(url);
      });
    });
  });
}

// 楽曲アイテムのHTMLを作成
function createSongItem(song) {
  const savedAt = song.savedAt ? new Date(song.savedAt).toLocaleString('ja-JP') : '不明';
  const tags = song.tags && song.tags.length > 0 
    ? `<div class="tags">${song.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
    : '';

  return `
    <div class="song-item">
      <h3>${escapeHtml(song.title || 'タイトルなし')}</h3>
      <div class="meta">保存日時: ${savedAt}</div>
      ${song.url ? `<div class="meta"><a href="${song.url}" target="_blank">${song.url}</a></div>` : ''}
      ${song.lyrics ? `<div class="content"><strong>歌詞:</strong><br>${escapeHtml(song.lyrics)}</div>` : ''}
      ${song.stylePrompt ? `<div class="content"><strong>Style:</strong><br>${escapeHtml(song.stylePrompt)}</div>` : ''}
      ${tags}
      <div class="actions">
        <button class="btn btn-small btn-secondary delete-song" data-url="${song.url}">削除</button>
        <button class="btn btn-small btn-primary copy-song" data-url="${song.url}">コピー</button>
      </div>
    </div>
  `;
}

// URLリストを読み込み
function loadUrls() {
  chrome.runtime.sendMessage({ action: 'getAllUrls' }, (response) => {
    const urlsList = document.getElementById('urls-list');
    
    if (!response || !response.success) {
      urlsList.innerHTML = '<p class="empty">エラーが発生しました</p>';
      return;
    }

    const urls = response.urls || [];

    if (urls.length === 0) {
      urlsList.innerHTML = '<p class="empty">保存済みのURLがありません</p>';
      return;
    }

    urlsList.innerHTML = urls.map(url => `
      <div class="url-item">
        <a href="${url}" target="_blank">${url}</a>
        <button class="btn btn-small btn-secondary delete-url" data-url="${url}">削除</button>
      </div>
    `).join('');

    // 削除ボタンのイベントリスナーを追加
    urlsList.querySelectorAll('.delete-url').forEach(button => {
      button.addEventListener('click', (e) => {
        const url = e.target.dataset.url;
        deleteUrl(url);
      });
    });
  });
}

// 楽曲を削除
function deleteSong(url) {
  chrome.runtime.sendMessage({ action: 'deleteSong', url: url }, (response) => {
    if (response && response.success) {
      loadSongs();
      showNotification('楽曲を削除しました');
    }
  });
}

// URLを削除
function deleteUrl(url) {
  chrome.runtime.sendMessage({ action: 'getAllUrls' }, (response) => {
    if (response && response.success) {
      const urls = response.urls.filter(u => u !== url);
      chrome.storage.local.set({ savedUrls: urls }, () => {
        loadUrls();
        showNotification('URLを削除しました');
      });
    }
  });
}

// 楽曲データをクリップボードにコピー
function copySongData(url) {
  chrome.runtime.sendMessage({ action: 'getAllSongs' }, (response) => {
    if (response && response.success) {
      const song = response.songs.find(s => s.url === url);
      if (song) {
        const text = `タイトル: ${song.title || 'なし'}\n\n` +
                    `URL: ${song.url || 'なし'}\n\n` +
                    (song.lyrics ? `歌詞:\n${song.lyrics}\n\n` : '') +
                    (song.stylePrompt ? `Style: ${song.stylePrompt}\n\n` : '') +
                    (song.tags && song.tags.length > 0 ? `タグ: ${song.tags.join(', ')}\n` : '');
        
        navigator.clipboard.writeText(text).then(() => {
          showNotification('クリップボードにコピーしました');
        }).catch(() => {
          // フォールバック: テキストエリアを使用
          const textarea = document.createElement('textarea');
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          showNotification('クリップボードにコピーしました');
        });
      }
    }
  });
}

// JSONをダウンロード
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 通知を表示
function showNotification(message) {
  // 簡単な通知（実際の実装ではより良いUIを提供）
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4caf50;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 10000;
    font-size: 14px;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

