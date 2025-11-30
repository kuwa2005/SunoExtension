// SunoAIページからデータを取得するContent Script

(function() {
  'use strict';

  // ページから楽曲情報を抽出する関数
  function extractSongData() {
    const data = {
      url: window.location.href,
      title: '',
      lyrics: '',
      stylePrompt: '',
      tags: [],
      timestamp: new Date().toISOString()
    };

    // タイトルの取得（複数の可能性を試す）
    const titleSelectors = [
      'h1',
      '[data-testid="song-title"]',
      '.song-title',
      'h2',
      'title'
    ];
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        data.title = element.textContent.trim();
        break;
      }
    }

    // 歌詞の取得
    const lyricsSelectors = [
      '[data-testid="lyrics"]',
      '.lyrics',
      '[class*="lyric"]',
      'pre'
    ];
    
    for (const selector of lyricsSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        data.lyrics = element.textContent.trim();
        break;
      }
    }

    // Styleプロンプトの取得
    const styleSelectors = [
      '[data-testid="style-prompt"]',
      '.style-prompt',
      '[class*="style"]',
      '[class*="prompt"]'
    ];
    
    for (const selector of styleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        data.stylePrompt = element.textContent.trim();
        break;
      }
    }

    // タグの取得
    const tagElements = document.querySelectorAll('[class*="tag"], [data-testid="tag"]');
    tagElements.forEach(tag => {
      const tagText = tag.textContent.trim();
      if (tagText) {
        data.tags.push(tagText);
      }
    });

    return data;
  }

  // ワークスペース内の全URLを取得する関数
  function getAllWorkspaceUrls() {
    const urls = [];
    
    // リンク要素からURLを収集
    const links = document.querySelectorAll('a[href*="suno.com"]');
    links.forEach(link => {
      const href = link.href;
      if (href && !urls.includes(href)) {
        urls.push(href);
      }
    });

    // データ属性やJSONからもURLを探す
    const scripts = document.querySelectorAll('script[type="application/json"]');
    scripts.forEach(script => {
      try {
        const json = JSON.parse(script.textContent);
        const jsonStr = JSON.stringify(json);
        const urlMatches = jsonStr.match(/https?:\/\/[^\s"']+suno\.com[^\s"']*/g);
        if (urlMatches) {
          urlMatches.forEach(url => {
            if (!urls.includes(url)) {
              urls.push(url);
            }
          });
        }
      } catch (e) {
        // JSON解析エラーは無視
      }
    });

    return urls;
  }

  // メッセージリスナー
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractSongData') {
      const songData = extractSongData();
      sendResponse({ success: true, data: songData });
      return true;
    }

    if (request.action === 'getAllUrls') {
      const urls = getAllWorkspaceUrls();
      sendResponse({ success: true, urls: urls });
      return true;
    }

    if (request.action === 'getPageInfo') {
      const pageInfo = {
        url: window.location.href,
        title: document.title,
        songData: extractSongData(),
        allUrls: getAllWorkspaceUrls()
      };
      sendResponse({ success: true, pageInfo: pageInfo });
      return true;
    }
  });

  // ページが読み込まれたときに現在のページ情報を通知
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      notifyPageLoaded();
    });
  } else {
    notifyPageLoaded();
  }

  function notifyPageLoaded() {
    // ページ情報をバックグラウンドに送信（オプション）
    chrome.runtime.sendMessage({
      action: 'pageLoaded',
      url: window.location.href
    });
  }
})();

