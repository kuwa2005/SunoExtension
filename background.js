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
        const urlCount = Array.isArray(response.urls) ? response.urls.length : 0;
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'SunoAI Extension',
          message: `${urlCount}個のURLを取得しました`
        });
      }
    });
  }

  if (info.menuItemId === 'exportAllData') {
    // Service Workerでのエクスポートに問題があるため、
    // ユーザーにpopupページからエクスポートするように案内
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'SunoAI Extension',
      message: 'エクスポートするには、拡張機能のアイコンをクリックして「アクション」タブの「全データをエクスポート」ボタンを使用してください。'
    });
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

// URLリストを保存（URL、タイトル、プロンプト、画像URLのペア）
async function saveUrls(urls) {
  try {
    const result = await chrome.storage.local.get(['savedUrls']);
    const savedUrls = result.savedUrls || [];
    
    // 新しいURLを追加（重複チェック）
    urls.forEach(urlItem => {
      // urlItemが文字列の場合はオブジェクトに変換
      const url = typeof urlItem === 'string' ? urlItem : urlItem.url;
      const title = typeof urlItem === 'string' ? '' : (urlItem.title || '');
      const prompt = typeof urlItem === 'string' ? '' : (urlItem.prompt || '');
      const imageUrl = typeof urlItem === 'string' ? '' : (urlItem.imageUrl || '');
      
      // 既存のURLを検索
      const existingIndex = savedUrls.findIndex(item => {
        const existingUrl = typeof item === 'string' ? item : item.url;
        return existingUrl === url;
      });
      
      if (existingIndex >= 0) {
        // 既存のURLを更新
        if (typeof savedUrls[existingIndex] === 'object') {
          // タイトル、プロンプト、画像URLが空でない場合のみ更新
          if (title) savedUrls[existingIndex].title = title;
          if (prompt) savedUrls[existingIndex].prompt = prompt;
          if (imageUrl) savedUrls[existingIndex].imageUrl = imageUrl;
        } else if (typeof savedUrls[existingIndex] === 'string') {
          savedUrls[existingIndex] = { url: url, title: title, prompt: prompt, imageUrl: imageUrl };
        }
      } else {
        // 新規追加
        savedUrls.push({ url: url, title: title, prompt: prompt, imageUrl: imageUrl });
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

    // Service WorkerではURL.createObjectURLが使えないため、data: URLを使用
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Service Workerで確実に動作する方法: encodeURIComponentを使用
    // data: URLのサイズ制限（約2MB）を考慮
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
    
    // chrome.downloads.downloadを使用してダウンロード
    chrome.downloads.download({
      url: dataUrl,
      filename: `suno-data-${new Date().toISOString().split('T')[0]}.json`,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('ダウンロードエラー:', chrome.runtime.lastError);
        // エラーが発生した場合、ユーザーに通知
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'SunoAI Extension',
          message: 'エクスポートに失敗しました。データが大きすぎる可能性があります。ポップアップからエクスポートを試してください。'
        });
      }
    });
  } catch (error) {
    console.error('エクスポートエラー:', error);
    // エラーが発生した場合、ユーザーに通知
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'SunoAI Extension',
        message: 'エクスポートに失敗しました。ポップアップからエクスポートを試してください。'
      });
    } catch (notifError) {
      // 通知エラーは無視
    }
  }
}

// デバッグログを保存
async function saveDebugLog(level, message, data = null) {
  try {
    const result = await chrome.storage.local.get(['debugLogs']);
    const logs = result.debugLogs || [];
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level, // 'info', 'error', 'success', 'warning'
      message: message,
      data: data
    };
    
    logs.push(logEntry);
    
    // 最新100件のみ保持（メモリ節約）
    if (logs.length > 100) {
      logs.shift();
    }
    
    await chrome.storage.local.set({ debugLogs: logs });
  } catch (error) {
    // デバッグログの保存エラーは無視（無限ループを防ぐ）
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

  if (request.action === 'debugLog') {
    saveDebugLog(request.level || 'info', request.message, request.data).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'getDebugLogs') {
    chrome.storage.local.get(['debugLogs'], (result) => {
      sendResponse({ success: true, logs: result.debugLogs || [] });
    });
    return true;
  }

  if (request.action === 'clearDebugLogs') {
    chrome.storage.local.set({ debugLogs: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

