// Popup Script

// デバッグログを送信する関数
function debugLog(level, message, data = null) {
  chrome.runtime.sendMessage({
    action: 'debugLog',
    level: level,
    message: message,
    data: data
  });
}

debugLog('info', 'popup.jsが読み込まれました');

document.addEventListener('DOMContentLoaded', () => {
  debugLog('info', 'DOMContentLoadedイベントが発火しました');
  initializeTabs();
  loadUrls();
  setupEventListeners();
  loadDebugLogs(); // デバッグ情報を読み込む
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
      if (targetTab === 'urls') {
        loadUrls();
      } else if (targetTab === 'debug') {
        loadDebugLogs();
      }
    });
  });
}

// イベントリスナーの設定
function setupEventListeners() {
  // 全URLを取得
  document.getElementById('get-all-urls').addEventListener('click', () => {
    debugLog('info', '全URL取得ボタンがクリックされました');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        debugLog('error', 'アクティブなタブが見つかりません', { error: chrome.runtime.lastError.message });
        alert('SunoAIのページで実行してください');
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getAllUrls' }, (response) => {
        if (chrome.runtime.lastError) {
          debugLog('error', 'sendMessageエラー', { error: chrome.runtime.lastError.message });
          alert('SunoAIのページで実行してください');
          return;
        }
        if (response && response.success) {
          debugLog('success', `URL取得成功: ${response.urls.length}件`);
          chrome.runtime.sendMessage({
            action: 'saveUrls',
            urls: response.urls
          }, () => {
            if (chrome.runtime.lastError) {
              debugLog('error', 'URL保存エラー', { error: chrome.runtime.lastError.message });
            } else {
              debugLog('success', 'URL保存成功');
            }
            loadUrls();
            const urlCount = Array.isArray(response.urls) ? response.urls.length : 0;
            showNotification(`${urlCount}個のURLを取得しました`);
          });
        } else {
          debugLog('error', 'URL取得失敗', { response: response });
        }
      });
    });
  });

  // クリップボードにコピー（選択可能）
  document.getElementById('copy-all-urls').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getAllUrls' }, (response) => {
      if (response && response.success) {
        const urls = response.urls || [];
        if (urls.length === 0) {
          showNotification('コピーするURLがありません');
          return;
        }
        showCopyModal(null, urls); // nullを渡すと全URLをコピー
      }
    });
  });

  // URLをエクスポート（選択可能）
  document.getElementById('export-urls').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getAllUrls' }, (response) => {
      if (response && response.success) {
        const urls = response.urls || [];
        if (urls.length === 0) {
          showNotification('エクスポートするURLがありません');
          return;
        }
        showExportModal(urls);
      }
    });
  });

  // クリアボタン
  document.getElementById('clear-urls').addEventListener('click', () => {
    if (confirm('すべてのURLを削除しますか？この操作は取り消せません。')) {
      chrome.storage.local.set({ savedUrls: [] }, () => {
        loadUrls();
        showNotification('すべてのURLを削除しました');
      });
    }
  });

  // 全データをエクスポート（選択可能）
  document.getElementById('export-all-data').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getAllUrls' }, (urlsResponse) => {
      const urls = urlsResponse.urls || [];
      if (urls.length === 0) {
        showNotification('エクスポートするURLがありません');
        return;
      }
      showExportModal(urls);
    });
  });

  // 全データを削除
  document.getElementById('clear-all-data').addEventListener('click', () => {
    if (confirm('本当に全データを削除しますか？この操作は取り消せません。')) {
      chrome.storage.local.clear(() => {
        loadUrls();
        showNotification('全データを削除しました');
      });
    }
  });

  // デバッグログをコピー
  const copyDebugBtn = document.getElementById('copy-debug');
  if (copyDebugBtn) {
    copyDebugBtn.addEventListener('click', () => {
      copyDebugLogs();
    });
  }

  // デバッグログをクリア
  const clearDebugBtn = document.getElementById('clear-debug');
  if (clearDebugBtn) {
    clearDebugBtn.addEventListener('click', () => {
      if (confirm('デバッグログをクリアしますか？')) {
        clearDebugLogs();
      }
    });
  }
}

// URLリストを読み込み
function loadUrls() {
  debugLog('info', 'loadUrls関数が呼ばれました');
  const urlsList = document.getElementById('urls-list');
  
  if (!urlsList) {
    debugLog('error', 'urls-list要素が見つかりません');
    return;
  }
  
  chrome.runtime.sendMessage({ action: 'getAllUrls' }, (response) => {
    debugLog('info', 'getAllUrlsレスポンス受信', { response: response });
    
    if (chrome.runtime.lastError) {
      debugLog('error', 'getAllUrlsエラー', { error: chrome.runtime.lastError.message });
      urlsList.innerHTML = '<p class="empty">エラーが発生しました: ' + escapeHtml(chrome.runtime.lastError.message) + '</p>';
      return;
    }
    
    if (!response || !response.success) {
      debugLog('error', 'レスポンスが不正です', { response: response });
      urlsList.innerHTML = '<p class="empty">エラーが発生しました</p>';
      return;
    }

    const urls = response.urls || [];
    
    debugLog('success', `URL読み込み成功: ${urls.length}件`);

    if (urls.length === 0) {
      urlsList.innerHTML = '<p class="empty">保存済みのURLがありません</p>';
      return;
    }

    const html = urls.map((item, index) => {
      const url = typeof item === 'string' ? item : item.url;
      const title = typeof item === 'string' ? '' : (item.title || '');
      const prompt = typeof item === 'string' ? '' : (item.prompt || '');
      const imageUrl = typeof item === 'string' ? '' : (item.imageUrl || '');
      
      // data-item属性用のJSONを安全にエスケープ（シングルクォートとダブルクォートの両方をエスケープ）
      const itemData = JSON.stringify({ url, title, prompt, imageUrl })
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');
      
      // HTMLを1行で生成（改行やインデントを削除）
      const imageHtml = imageUrl 
        ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title || '')}" class="url-image" onerror="this.style.display='none'">` 
        : '<div class="url-image-placeholder">●</div>';
      const titleHtml = title ? `<div class="url-title">${escapeHtml(title)}</div>` : '';
      const promptHtml = prompt ? `<div class="url-prompt">${escapeHtml(prompt)}</div>` : '';
      
      return `<div class="url-item"><div class="url-item-inner"><div class="url-content">${imageHtml}<div class="url-text"><a href="${escapeHtml(url)}" target="_blank" class="url-link">${escapeHtml(url)}</a>${titleHtml}${promptHtml}</div></div><div class="url-actions"><button class="btn btn-small btn-primary detail-url" data-index="${index}" data-item="${itemData}">詳細</button><button class="btn btn-small btn-primary copy-url" data-url="${escapeHtml(url)}" data-item="${itemData}">コピー</button><button class="btn btn-small btn-secondary delete-url" data-url="${escapeHtml(url)}">削除</button></div></div></div>`;
    }).join('');
    
    debugLog('info', `HTML生成完了: ${urls.length}アイテム、${html.length}文字`);
    
    // HTMLの最初の500文字をデバッグログに出力
    debugLog('info', `生成されたHTML（最初の500文字）: ${html.substring(0, 500)}`);
    
    // innerHTMLを設定
    urlsList.innerHTML = html;
    
    // 即座にDOM要素数を確認
    const urlItemsImmediate = urlsList.querySelectorAll('.url-item');
    debugLog('info', `innerHTML設定直後のDOM要素数: ${urlItemsImmediate.length}`);
    debugLog('info', `urlsList.innerHTMLの長さ: ${urlsList.innerHTML.length}`);
    
    // DOM要素が正しく追加されたか確認
    setTimeout(() => {
      const urlItems = urlsList.querySelectorAll('.url-item');
      debugLog('info', `100ms後のDOM要素数: ${urlItems.length}`);
      
      if (urlItems.length !== urls.length) {
        debugLog('error', '警告: 生成したHTMLアイテム数とDOM要素数が一致しません', {
          expected: urls.length,
          actual: urlItems.length,
          htmlLength: html.length,
          innerHTMLLength: urlsList.innerHTML.length
        });
        
        // 実際のHTMLの構造を確認
        debugLog('info', `実際のinnerHTML（最初の1000文字）: ${urlsList.innerHTML.substring(0, 1000)}`);
      }
    }, 100);

    // 詳細ボタンのイベントリスナーを追加
    try {
      const detailButtons = urlsList.querySelectorAll('.detail-url');
      debugLog('info', `詳細ボタン数: ${detailButtons.length}`);
      detailButtons.forEach((button, idx) => {
        try {
          button.addEventListener('click', (e) => {
            try {
              const itemData = JSON.parse(e.target.dataset.item.replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
              showDetailModal(itemData);
            } catch (err) {
              debugLog('error', `詳細ボタンクリックエラー: ${err.message}`, { error: err });
            }
          });
        } catch (err) {
          debugLog('error', `詳細ボタン${idx}のイベントリスナー追加エラー: ${err.message}`, { error: err });
        }
      });
    } catch (err) {
      debugLog('error', `詳細ボタンのイベントリスナー追加エラー: ${err.message}`, { error: err });
    }

    // コピーボタンのイベントリスナーを追加
    try {
      const copyButtons = urlsList.querySelectorAll('.copy-url');
      debugLog('info', `コピーボタン数: ${copyButtons.length}`);
      copyButtons.forEach((button, idx) => {
        try {
          button.addEventListener('click', (e) => {
            try {
              const itemData = JSON.parse(e.target.dataset.item.replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
              showCopyModal(itemData);
            } catch (err) {
              debugLog('error', `コピーボタンクリックエラー: ${err.message}`, { error: err });
            }
          });
        } catch (err) {
          debugLog('error', `コピーボタン${idx}のイベントリスナー追加エラー: ${err.message}`, { error: err });
        }
      });
    } catch (err) {
      debugLog('error', `コピーボタンのイベントリスナー追加エラー: ${err.message}`, { error: err });
    }

    // 削除ボタンのイベントリスナーを追加
    try {
      const deleteButtons = urlsList.querySelectorAll('.delete-url');
      debugLog('info', `削除ボタン数: ${deleteButtons.length}`);
      deleteButtons.forEach((button, idx) => {
        try {
          button.addEventListener('click', (e) => {
            const url = e.target.dataset.url;
            deleteUrl(url);
          });
        } catch (err) {
          debugLog('error', `削除ボタン${idx}のイベントリスナー追加エラー: ${err.message}`, { error: err });
        }
      });
    } catch (err) {
      debugLog('error', `削除ボタンのイベントリスナー追加エラー: ${err.message}`, { error: err });
    }
  });
}

// 詳細モーダルを表示
function showDetailModal(itemData) {
  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('detail-content');
  
  content.innerHTML = `
    ${itemData.imageUrl ? `<div class="detail-image"><img src="${escapeHtml(itemData.imageUrl)}" alt="${escapeHtml(itemData.title || '')}" onerror="this.style.display='none'"></div>` : ''}
    <div class="detail-section">
      <h3>URL</h3>
      <p><a href="${escapeHtml(itemData.url)}" target="_blank">${escapeHtml(itemData.url)}</a></p>
    </div>
    ${itemData.title ? `
    <div class="detail-section">
      <h3>タイトル</h3>
      <p>${escapeHtml(itemData.title)}</p>
    </div>
    ` : ''}
    ${itemData.prompt ? `
    <div class="detail-section">
      <h3>Styleプロンプト</h3>
      <p>${escapeHtml(itemData.prompt)}</p>
    </div>
    ` : ''}
    ${itemData.imageUrl ? `
    <div class="detail-section">
      <h3>画像URL</h3>
      <p><a href="${escapeHtml(itemData.imageUrl)}" target="_blank">${escapeHtml(itemData.imageUrl)}</a></p>
    </div>
    ` : ''}
  `;
  
  modal.style.display = 'block';
  
  // モーダルを閉じる
  document.getElementById('close-modal').onclick = () => {
    modal.style.display = 'none';
  };
  
  // モーダル外をクリックで閉じる
  window.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// コピー選択モーダルを表示
let currentCopyData = null;
let currentCopyUrls = null;

function showCopyModal(itemData, allUrls = null) {
  const modal = document.getElementById('copy-modal');
  currentCopyData = itemData;
  currentCopyUrls = allUrls;
  
  // チェックボックスをリセット
  document.getElementById('copy-url').checked = true;
  document.getElementById('copy-title').checked = true;
  document.getElementById('copy-prompt').checked = true;
  document.getElementById('copy-image').checked = false;
  
  modal.style.display = 'block';
  
  // モーダルを閉じる
  document.getElementById('close-copy-modal').onclick = () => {
    modal.style.display = 'none';
  };
  
  document.getElementById('cancel-copy').onclick = () => {
    modal.style.display = 'none';
  };
  
  // コピー実行
  document.getElementById('confirm-copy').onclick = () => {
    const includeUrl = document.getElementById('copy-url').checked;
    const includeTitle = document.getElementById('copy-title').checked;
    const includePrompt = document.getElementById('copy-prompt').checked;
    const includeImage = document.getElementById('copy-image').checked;
    
    let text = '';
    
    if (currentCopyUrls) {
      // 全URLをコピー
      const lines = currentCopyUrls.map(item => {
        const url = typeof item === 'string' ? item : item.url;
        const title = typeof item === 'string' ? '' : (item.title || '');
        const prompt = typeof item === 'string' ? '' : (item.prompt || '');
        const imageUrl = typeof item === 'string' ? '' : (item.imageUrl || '');
        
        const parts = [];
        if (includeUrl) parts.push(url);
        if (includeTitle) parts.push(title);
        if (includePrompt) parts.push(prompt);
        if (includeImage) parts.push(imageUrl);
        
        return parts.join('\t');
      });
      text = lines.join('\n');
    } else if (currentCopyData) {
      // 単一URLをコピー
      const parts = [];
      if (includeUrl) parts.push(currentCopyData.url);
      if (includeTitle) parts.push(currentCopyData.title || '');
      if (includePrompt) parts.push(currentCopyData.prompt || '');
      if (includeImage) parts.push(currentCopyData.imageUrl || '');
      text = parts.join('\t');
    }
    
    copyToClipboard(text);
    modal.style.display = 'none';
    const count = currentCopyUrls ? currentCopyUrls.length : 1;
    showNotification(`${count}件の情報をクリップボードにコピーしました`);
  };
  
  // モーダル外をクリックで閉じる
  window.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// エクスポート選択モーダルを表示
let currentExportUrls = null;

function showExportModal(urls) {
  const modal = document.getElementById('export-modal');
  currentExportUrls = urls;
  
  // チェックボックスをリセット
  document.getElementById('export-url').checked = true;
  document.getElementById('export-title').checked = true;
  document.getElementById('export-prompt').checked = true;
  document.getElementById('export-image').checked = false;
  
  modal.style.display = 'block';
  
  // モーダルを閉じる
  document.getElementById('close-export-modal').onclick = () => {
    modal.style.display = 'none';
  };
  
  document.getElementById('cancel-export').onclick = () => {
    modal.style.display = 'none';
  };
  
  // エクスポート実行
  document.getElementById('confirm-export').onclick = () => {
    const includeUrl = document.getElementById('export-url').checked;
    const includeTitle = document.getElementById('export-title').checked;
    const includePrompt = document.getElementById('export-prompt').checked;
    const includeImage = document.getElementById('export-image').checked;
    
    const lines = currentExportUrls.map(item => {
      const url = typeof item === 'string' ? item : item.url;
      const title = typeof item === 'string' ? '' : (item.title || '');
      const prompt = typeof item === 'string' ? '' : (item.prompt || '');
      const imageUrl = typeof item === 'string' ? '' : (item.imageUrl || '');
      
      const parts = [];
      if (includeUrl) parts.push(url);
      if (includeTitle) parts.push(title);
      if (includePrompt) parts.push(prompt);
      if (includeImage) parts.push(imageUrl);
      
      return parts.join('\t');
    });
    
    const textContent = lines.join('\n');
    downloadTextFile(textContent, `suno-urls-${new Date().toISOString().split('T')[0]}.txt`);
    modal.style.display = 'none';
    showNotification(`${currentExportUrls.length}件の情報をエクスポートしました`);
  };
  
  // モーダル外をクリックで閉じる
  window.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// URLを削除
function deleteUrl(url) {
  chrome.runtime.sendMessage({ action: 'getAllUrls' }, (response) => {
    if (response && response.success) {
      const urls = response.urls.filter(item => {
        const itemUrl = typeof item === 'string' ? item : item.url;
        return itemUrl !== url;
      });
      chrome.storage.local.set({ savedUrls: urls }, () => {
        loadUrls();
        showNotification('URLを削除しました');
      });
    }
  });
}


// クリップボードにコピーする共通関数
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('クリップボードにコピーしました');
  }).catch(() => {
    // フォールバック: テキストエリアを使用
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showNotification('クリップボードにコピーしました');
  });
}

// テキストファイルをダウンロード
function downloadTextFile(textContent, filename) {
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

// デバッグログを読み込み
function loadDebugLogs() {
  chrome.runtime.sendMessage({ action: 'getDebugLogs' }, (response) => {
    const debugLog = document.getElementById('debug-log');
    if (!debugLog) return;
    
    if (chrome.runtime.lastError) {
      debugLog.innerHTML = '<p class="empty">デバッグログの読み込みに失敗しました</p>';
      return;
    }
    
    const logs = response.logs || [];
    
    if (logs.length === 0) {
      debugLog.innerHTML = '<p class="empty">デバッグ情報がありません</p>';
      return;
    }
    
    const html = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString('ja-JP');
      const levelClass = `debug-${log.level}`;
      const dataStr = log.data ? ' ' + JSON.stringify(log.data).substring(0, 200) : '';
      return `
        <div class="debug-entry">
          <span class="debug-time">[${time}]</span>
          <span class="debug-message ${levelClass}">[${log.level.toUpperCase()}] ${escapeHtml(log.message)}${escapeHtml(dataStr)}</span>
        </div>
      `;
    }).join('');
    
    debugLog.innerHTML = html;
    // 最新のログにスクロール
    debugLog.scrollTop = debugLog.scrollHeight;
  });
}

// デバッグログをクリップボードにコピー
function copyDebugLogs() {
  chrome.runtime.sendMessage({ action: 'getDebugLogs' }, (response) => {
    if (chrome.runtime.lastError) {
      debugLog('error', 'デバッグログの取得に失敗しました', { error: chrome.runtime.lastError.message });
      showNotification('デバッグログのコピーに失敗しました');
      return;
    }
    
    const logs = response.logs || [];
    
    if (logs.length === 0) {
      showNotification('コピーするデバッグ情報がありません');
      return;
    }
    
    // デバッグログをテキスト形式にフォーマット
    const textLines = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleString('ja-JP');
      const level = log.level.toUpperCase().padEnd(8);
      const message = log.message;
      const dataStr = log.data ? ' ' + JSON.stringify(log.data) : '';
      return `[${time}] [${level}] ${message}${dataStr}`;
    });
    
    const text = textLines.join('\n');
    
    // クリップボードにコピー
    copyToClipboard(text);
    showNotification(`${logs.length}件のデバッグログをクリップボードにコピーしました`);
  });
}

// デバッグログをクリア
function clearDebugLogs() {
  chrome.runtime.sendMessage({ action: 'clearDebugLogs' }, () => {
    loadDebugLogs();
    showNotification('デバッグログをクリアしました');
  });
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

