// Background Service Worker

// 拡張機能がインストールされたとき
chrome.runtime.onInstalled.addListener(() => {
  // 右クリックメニューを作成
  chrome.contextMenus.create({
    id: 'saveSongData',
    title: '楽曲情報を保存',
    contexts: ['page'],
    documentUrlPatterns: ['https://suno.com/*', 'https://*.suno.com/*']
  });

  chrome.contextMenus.create({
    id: 'getAllUrls',
    title: 'ワークスペース内の全URLを取得',
    contexts: ['page'],
    documentUrlPatterns: ['https://suno.com/*', 'https://*.suno.com/*']
  });

  chrome.contextMenus.create({
    id: 'exportAllData',
    title: '保存済みデータをエクスポート',
    contexts: ['page']
  });
});

// 右クリックメニューのクリック処理
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'saveSongData') {
    // 現在のタブでcontent scriptにメッセージを送信
    chrome.tabs.sendMessage(tab.id, { action: 'extractSongData' }, (response) => {
      if (response && response.success) {
        saveSongData(response.data);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'SunoAI Extension',
          message: '楽曲情報を保存しました'
        });
      }
    });
  }

  if (info.menuItemId === 'getAllUrls') {
    chrome.tabs.sendMessage(tab.id, { action: 'getAllUrls' }, (response) => {
      if (response && response.success) {
        saveUrls(response.urls);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'SunoAI Extension',
          message: `${response.urls.length}個のURLを取得しました`
        });
      }
    });
  }

  if (info.menuItemId === 'exportAllData') {
    exportAllData();
  }
});

// 楽曲データを保存
async function saveSongData(songData) {
  try {
    const result = await chrome.storage.local.get(['savedSongs']);
    const savedSongs = result.savedSongs || [];
    
    // 既に同じURLのデータがあるかチェック
    const existingIndex = savedSongs.findIndex(song => song.url === songData.url);
    
    if (existingIndex >= 0) {
      // 既存データを更新
      savedSongs[existingIndex] = {
        ...songData,
        updatedAt: new Date().toISOString()
      };
    } else {
      // 新規追加
      savedSongs.push({
        ...songData,
        savedAt: new Date().toISOString()
      });
    }

    await chrome.storage.local.set({ savedSongs });
  } catch (error) {
    console.error('データ保存エラー:', error);
  }
}

// URLリストを保存
async function saveUrls(urls) {
  try {
    const result = await chrome.storage.local.get(['savedUrls']);
    const savedUrls = result.savedUrls || [];
    
    // 新しいURLを追加（重複チェック）
    urls.forEach(url => {
      if (!savedUrls.includes(url)) {
        savedUrls.push(url);
      }
    });

    await chrome.storage.local.set({ 
      savedUrls,
      lastUrlUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('URL保存エラー:', error);
  }
}

// 全データをエクスポート
async function exportAllData() {
  try {
    const result = await chrome.storage.local.get(['savedSongs', 'savedUrls']);
    const exportData = {
      songs: result.savedSongs || [],
      urls: result.savedUrls || [],
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: `suno-data-${new Date().toISOString().split('T')[0]}.json`,
      saveAs: true
    });
  } catch (error) {
    console.error('エクスポートエラー:', error);
  }
}

// メッセージハンドラー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveSongData') {
    saveSongData(request.data).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'getAllSongs') {
    chrome.storage.local.get(['savedSongs'], (result) => {
      sendResponse({ success: true, songs: result.savedSongs || [] });
    });
    return true;
  }

  if (request.action === 'deleteSong') {
    chrome.storage.local.get(['savedSongs'], (result) => {
      const savedSongs = result.savedSongs || [];
      const filtered = savedSongs.filter(song => song.url !== request.url);
      chrome.storage.local.set({ savedSongs: filtered }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'getAllUrls') {
    chrome.storage.local.get(['savedUrls'], (result) => {
      sendResponse({ success: true, urls: result.savedUrls || [] });
    });
    return true;
  }

  if (request.action === 'saveUrls') {
    saveUrls(request.urls).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

