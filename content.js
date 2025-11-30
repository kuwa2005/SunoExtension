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
    const urls = new Set(); // Setを使用して重複を自動的に排除
    
    // 1. リンク要素からURLを収集（楽曲URLのみ）
    const linkSelectors = [
      'a[href*="/song/"]',
      '[href*="/song/"]',
      '[data-href*="/song/"]',
      '[data-url*="/song/"]'
    ];
    
    linkSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const href = element.href || element.getAttribute('href') || 
                      element.getAttribute('data-href') || 
                      element.getAttribute('data-url');
          // 楽曲URLのみを処理（/song/を含むURL）
          if (href && (href.includes('/song/') || href.includes('suno.com/song/'))) {
            // 相対URLを絶対URLに変換
            try {
              const absoluteUrl = new URL(href, window.location.origin).href;
              // 楽曲URLのみを追加
              if (absoluteUrl.includes('suno.com/song/')) {
                urls.add(absoluteUrl.split('?')[0].split('#')[0]); // クエリパラメータとハッシュを除去
              }
            } catch (e) {
              // URL解析エラーは無視
            }
          }
        });
      } catch (e) {
        // セレクタエラーは無視
      }
    });

    // 2. すべてのスクリプトタグからJSONデータを検索
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => {
      const content = script.textContent || script.innerHTML;
      if (content) {
        // JSON形式のデータを探す
        try {
          const json = JSON.parse(content);
          const jsonStr = JSON.stringify(json);
          extractUrlsFromText(jsonStr, urls);
        } catch (e) {
          // JSON解析エラーは無視し、テキストから直接URLを抽出
          extractUrlsFromText(content, urls);
        }
      }
    });

    // 3. ページ全体のテキストからURLパターンを抽出
    const bodyText = document.body ? document.body.innerText : '';
    extractUrlsFromText(bodyText, urls);

    // 4. データ属性からURLを取得（パフォーマンスを考慮して主要な要素のみ）
    const dataSelectors = [
      '[data-href]',
      '[data-url]',
      '[data-link]',
      '[data-song-url]',
      '[data-song-id]',
      '[href]',
      '[src]'
    ];
    
    dataSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          Array.from(element.attributes).forEach(attr => {
            // data-で始まる属性またはhref, src属性をチェック（楽曲URLのみ）
            if ((attr.name.startsWith('data-') || attr.name === 'href' || attr.name === 'src') && 
                attr.value && (attr.value.includes('/song/') || attr.value.includes('suno.com/song/'))) {
              extractUrlsFromText(attr.value, urls);
            }
          });
        });
      } catch (e) {
        // セレクタエラーは無視
      }
    });

    // 5. windowオブジェクトやReactの状態からURLを取得（可能な場合）
    try {
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        // React DevToolsが利用可能な場合、コンポーネントツリーからURLを探す
        const reactRoots = document.querySelectorAll('[data-reactroot], [id*="root"]');
        reactRoots.forEach(root => {
          extractUrlsFromText(root.innerHTML, urls);
        });
      }
    } catch (e) {
      // React DevToolsエラーは無視
    }

    // Setを配列に変換して返す
    // 楽曲URLのみをフィルタリング（https://suno.com/song/で始まるURLのみ）
    return Array.from(urls).filter(url => {
      // 楽曲URLのみを返す（https://suno.com/song/で始まるURL）
      if (!url || !url.startsWith('http')) {
        return false;
      }
      // https://suno.com/song/で始まるURLのみを許可
      return url.includes('suno.com/song/') && url.match(/^https:\/\/suno\.com\/song\/[a-zA-Z0-9-]+/);
    }).map(url => {
      // URLを正規化（クエリパラメータやハッシュを除去）
      try {
        const urlObj = new URL(url);
        // パスが/song/で始まる場合のみ返す
        if (urlObj.pathname.startsWith('/song/')) {
          return `${urlObj.origin}${urlObj.pathname}`;
        }
        return null;
      } catch (e) {
        return null;
      }
    }).filter(url => url !== null); // nullを除去
  }

  // テキストからURLを抽出するヘルパー関数（楽曲URLのみ）
  function extractUrlsFromText(text, urlSet) {
    if (!text) return;
    
    // 楽曲URLのパターンのみをマッチング
    const urlPatterns = [
      /https?:\/\/suno\.com\/song\/[a-zA-Z0-9-]+/g,  // 完全な楽曲URL
      /suno\.com\/song\/[a-zA-Z0-9-]+/g,  // suno.com/song/で始まるURL
      /\/song\/[a-zA-Z0-9-]+/g  // /song/で始まるパス
    ];

    urlPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          try {
            let url = match.trim();
            
            // 完全なURLの場合（https://suno.com/song/...）
            if (url.startsWith('http://') || url.startsWith('https://')) {
              const absoluteUrl = new URL(url).href;
              // 楽曲URLのみを追加
              if (absoluteUrl.includes('suno.com/song/')) {
                const normalizedUrl = absoluteUrl.split('?')[0].split('#')[0];
                urlSet.add(normalizedUrl);
              }
            }
            // suno.com/song/で始まるURLの場合
            else if (url.includes('suno.com/song/')) {
              const absoluteUrl = new URL('https://' + url, window.location.origin).href;
              if (absoluteUrl.includes('suno.com/song/')) {
                const normalizedUrl = absoluteUrl.split('?')[0].split('#')[0];
                urlSet.add(normalizedUrl);
              }
            }
            // 相対パスの場合（/song/で始まる）
            else if (url.startsWith('/song/')) {
              const absoluteUrl = new URL(url, window.location.origin).href;
              if (absoluteUrl.includes('suno.com/song/')) {
                const normalizedUrl = absoluteUrl.split('?')[0].split('#')[0];
                urlSet.add(normalizedUrl);
              }
            }
          } catch (e) {
            // URL解析エラーは無視
          }
        });
      }
    });
  }

  // メッセージリスナー
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractSongData') {
      const songData = extractSongData();
      sendResponse({ success: true, data: songData });
      return true;
    }

    if (request.action === 'getAllUrls') {
      // デバッグ情報を初期化
      window._sunoDebugInfo = [];
      
      const urls = getAllWorkspaceUrls();
      // URL、タイトル、プロンプト、画像URLのペアを取得
      const urlsWithData = urls.map((url, index) => {
            // URLからUUIDを抽出（最後の部分）
            const urlParts = url.split('/');
            const uuid = urlParts[urlParts.length - 1];

            let title = '';
            let prompt = '';
            let imageUrl = '';

            // リンク要素を探す（href属性にUUIDが含まれるもの）
            // HTML構造から、`href="/song/{uuid}"`形式のリンクを探す
            const linkSelectors = [
              `a[href="/song/${uuid}"]`, // 完全一致（相対パス）
              `a[href*="/song/${uuid}"]`, // 部分一致（相対パス）
              `a[href*="${uuid}"]`, // UUIDを含む
              `[href*="/song/${uuid}"]` // その他の要素
            ];
            
            let link = null;
            for (const selector of linkSelectors) {
              try {
                const links = document.querySelectorAll(selector);
                // 完全一致を優先
                for (const l of links) {
                  const href = l.getAttribute('href') || l.href || '';
                  // 相対パス（/song/{uuid}）または絶対パス（https://suno.com/song/{uuid}）をチェック
                  if (href.includes(uuid) && (href.includes('/song/') || href.includes('suno.com/song/'))) {
                    link = l;
                    break;
                  }
                }
                if (link) break;
              } catch (e) {
                // セレクタエラーは無視
              }
            }
            
            // リンクが見つからない場合、すべてのa要素を走査
            if (!link) {
              try {
                const allLinks = document.querySelectorAll('a[href*="/song/"]');
                for (const l of allLinks) {
                  const href = l.getAttribute('href') || l.href || '';
                  if (href.includes(uuid)) {
                    link = l;
                    break;
                  }
                }
              } catch (e) {
                // エラーは無視
              }
            }
            
            // デバッグログは後でまとめて送信（同期的に送信しない）
        
        if (link) {
          // タイトルをリンクのテキストから取得
          title = link.textContent.trim() || link.getAttribute('title') || link.getAttribute('aria-label') || '';
          
          // リンク要素の親要素（clip-rowなど）を探す
          const parent = link.closest('[data-testid="clip-row"], [class*="clip-row"], [class*="song"], [class*="card"], [class*="item"], [role="row"]');
          
          if (parent) {
            // タイトルが空の場合、リンクの周辺からタイトルを探す
            if (!title) {
              // リンクの親要素からタイトルを探す
              const linkParent = link.parentElement;
              if (linkParent) {
                // 親要素内のテキストからタイトルを抽出
                const parentText = linkParent.textContent.trim();
                // リンクのテキストが空の場合、親要素の最初のテキストノードを取得
                if (parentText && parentText !== link.textContent.trim()) {
                  // リンクのテキストを含む最初の部分をタイトルとして使用
                  const linkIndex = parentText.indexOf(link.textContent.trim());
                  if (linkIndex >= 0) {
                    title = parentText.substring(0, linkIndex + link.textContent.trim().length).trim();
                    // 改行や余分な文字を除去
                    title = title.split('\n')[0].trim();
                  }
                }
              }
            }
            
            // プロンプトを取得（SunoAIの構造に合わせたセレクタ）
            // HTML構造から、`css-ingj1g emi8w7v14`クラスを持つdiv要素がプロンプト
            // まず、親要素内のすべてのdiv要素を走査して、プロンプトらしいテキストを含むものを探す
            const allDivs = parent.querySelectorAll('div');
            let promptDivsFound = 0;
            
            // デバッグ情報を初期化（最初の3件のみ）
            if (index < 3) {
              if (!window._sunoDebugInfo) {
                window._sunoDebugInfo = [];
              }
              window._sunoDebugInfo[index] = { 
                url: url, 
                index: index, 
                parentFound: !!parent, 
                allDivsCount: allDivs.length, 
                promptCandidates: [],
                hasLink: !!link,
                title: title || ''
              };
            }
            
            for (const div of allDivs) {
              // クラス名をチェック（ingj1gまたはemi8w7v14を含む）
              const classList = div.className || '';
              const hasIngj1g = classList.includes('ingj1g');
              const hasEmi8w7v14 = classList.includes('emi8w7v14');
              const hasPromptClass = (hasIngj1g || hasEmi8w7v14) &&
                                    !div.contains(link) &&
                                    !div.querySelector('button') &&
                                    !div.querySelector('svg') &&
                                    !div.querySelector('a[href*="/song/"]');
              
              if (hasPromptClass) {
                promptDivsFound++;
                const promptText = div.textContent.trim();
                // デバッグ情報を収集（最初の3件のみ）
                if (index < 3 && promptText && window._sunoDebugInfo && window._sunoDebugInfo[index]) {
                  window._sunoDebugInfo[index].promptCandidates.push({
                    hasIngj1g: hasIngj1g,
                    hasEmi8w7v14: hasEmi8w7v14,
                    className: classList,
                    textLength: promptText.length,
                    textPreview: promptText.substring(0, 100)
                  });
                }
                // プロンプトらしいテキストかチェック
                if (promptText && 
                    promptText.length > 20 && 
                    !promptText.match(/^v\d+$/) && 
                    !promptText.startsWith('http') &&
                    promptText !== '(no styles)' &&
                    !promptText.match(/^Uploaded$/)) {
                  prompt = promptText;
                  break;
                }
              }
            }
            
            // デバッグ情報を更新
            if (index < 3 && window._sunoDebugInfo && window._sunoDebugInfo[index]) {
              window._sunoDebugInfo[index].promptDivsFound = promptDivsFound;
              window._sunoDebugInfo[index].promptFound = !!prompt;
            }
            
            // プロンプトが見つからない場合、特定のセレクタを試す
            if (!prompt) {
              const promptSelectors = [
                'div[class*="ingj1g"][class*="emi8w7v14"]', // 両方のクラスを含む
                'div[class*="ingj1g"]', // ingj1gを含むクラス
                'div[class*="emi8w7v14"]', // emi8w7v14を含むクラス
                '[data-testid="style-prompt"]',
                '.style-prompt',
                '[class*="prompt"]'
              ];
              
              for (const selector of promptSelectors) {
                try {
                  const promptElement = parent.querySelector(selector);
                  if (promptElement && promptElement.textContent.trim()) {
                    const promptText = promptElement.textContent.trim();
                    // プロンプトらしいテキストかチェック
                    if (promptText.length > 20 && 
                        !promptText.match(/^v\d+$/) && 
                        !promptText.startsWith('http') &&
                        promptText !== '(no styles)' &&
                        !promptElement.contains(link)) {
                      prompt = promptText;
                      break;
                    }
                  }
                } catch (e) {
                  // セレクタエラーは無視
                }
              }
            }
            
            // まだプロンプトが見つからない場合、親要素内のすべてのdiv要素を走査
            if (!prompt && parent) {
              for (const div of allDivs) {
                const text = div.textContent.trim();
                // プロンプトらしいテキストかチェック
                // - 長さが50文字以上
                // - カンマを含む（複数のキーワードが含まれる）
                // - v5のような短いテキストでない
                // - URLでない
                // - リンク要素の子要素でない
                // - ボタンやアイコンを含まない
                if (text && 
                    text.length > 50 && 
                    text.includes(',') && 
                    !text.match(/^v\d+$/) && 
                    !text.startsWith('http') &&
                    !div.contains(link) &&
                    !link.contains(div) &&
                    !div.querySelector('a[href*="/song/"]') &&
                    !div.querySelector('button') &&
                    !div.querySelector('svg') &&
                    text !== '(no styles)') {
                  // さらに、タイトルを含まないことを確認
                  if (!title || !text.includes(title) || text.length > title.length * 2) {
                    prompt = text;
                    break;
                  }
                }
              }
            }
            
            // まだプロンプトが見つからない場合、リンク要素の次の兄弟要素を探す
            if (!prompt) {
              const linkParent = link.parentElement;
              if (linkParent) {
                // タイトルを含むdiv要素を探す
                const titleContainer = linkParent.closest('div') || linkParent;
                let currentElement = titleContainer.nextElementSibling;
                let attempts = 0;
                while (currentElement && attempts < 10) {
                  const text = currentElement.textContent.trim();
                  if (text && 
                      text.length > 30 && 
                      text.includes(',') && 
                      !text.match(/^v\d+$/) && 
                      !text.startsWith('http') &&
                      !currentElement.querySelector('button') &&
                      !currentElement.querySelector('svg')) {
                    prompt = text;
                    break;
                  }
                  currentElement = currentElement.nextElementSibling;
                  attempts++;
                }
              }
            }
            
            // 画像URLを取得
            const imageSelectors = [
              'img[data-src*="suno"], img[data-src*="cdn"]',
              'img[src*="suno"], img[src*="cdn"]',
              'img[alt*="artwork"]',
              'img'
            ];
            
            for (const selector of imageSelectors) {
              try {
                const imageElement = parent.querySelector(selector);
                if (imageElement) {
                  // data-src属性を優先（高解像度画像）
                  imageUrl = imageElement.getAttribute('data-src') || imageElement.src || '';
                  
                  // data-srcが相対パスの場合は無視
                  if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('//'))) {
                    // 高解像度画像URLに変換（可能な場合）
                    if (imageUrl.includes('?width=')) {
                      imageUrl = imageUrl.replace('?width=100', '').replace('?width=200', '');
                    }
                    // image_d4475107...をimage_large_d4475107...に変換
                    if (imageUrl.includes('/image_') && !imageUrl.includes('/image_large_')) {
                      imageUrl = imageUrl.replace('/image_', '/image_large_');
                    }
                    break;
                  } else {
                    imageUrl = '';
                  }
                }
              } catch (e) {
                // セレクタエラーは無視
              }
            }
          }
        }
        
        // タイトルが取得できない場合は、ページタイトルから取得を試みる（現在のページの場合）
        if (!title && url === window.location.href) {
          title = document.title.replace(' | Suno', '').trim();
          
          // プロンプトも取得を試みる
          const pagePromptSelectors = [
            '[class*="ingj1g"]',
            '[class*="css-ingj1g"]',
            '[data-testid="style-prompt"]',
            '.style-prompt'
          ];
          
          for (const selector of pagePromptSelectors) {
            try {
              const promptElement = document.querySelector(selector);
              if (promptElement && promptElement.textContent.trim()) {
                prompt = promptElement.textContent.trim();
                break;
              }
            } catch (e) {
              // セレクタエラーは無視
            }
          }
          
          // 画像URLも取得を試みる
          const pageImageSelectors = [
            'img[data-src*="suno"], img[data-src*="cdn"]',
            'img[src*="suno"], img[src*="cdn"]',
            'img[alt*="artwork"]'
          ];
          
          for (const selector of pageImageSelectors) {
            try {
              const imageElement = document.querySelector(selector);
              if (imageElement) {
                imageUrl = imageElement.getAttribute('data-src') || imageElement.src || '';
                if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('//'))) {
                  if (imageUrl.includes('/image_') && !imageUrl.includes('/image_large_')) {
                    imageUrl = imageUrl.replace('/image_', '/image_large_');
                  }
                  break;
                }
              }
            } catch (e) {
              // セレクタエラーは無視
            }
          }
        }
        
        return {
          url: url,
          title: title || '',
          prompt: prompt || '',
          imageUrl: imageUrl || ''
        };
      });
      
      // sendResponseを先に呼び出して、メッセージポートを保持
      sendResponse({ success: true, urls: urlsWithData });
      
      // デバッグ情報は非同期で送信（メッセージポートを閉じた後に送信）
      setTimeout(() => {
        try {
          // 保存されたデバッグ情報を送信
          if (window._sunoDebugInfo && Array.isArray(window._sunoDebugInfo) && window._sunoDebugInfo.length > 0) {
            window._sunoDebugInfo.forEach((info) => {
              if (info) {
                chrome.runtime.sendMessage({
                  action: 'debugLog',
                  level: 'info',
                  message: `URL ${info.index + 1}: リンク${info.hasLink ? 'あり' : 'なし'}, 親要素${info.parentFound ? 'あり' : 'なし'}, div要素数=${info.allDivsCount || 0}, プロンプトdiv要素数=${info.promptDivsFound || 0}, プロンプト取得${info.promptFound ? '成功' : '失敗'}`,
                  data: info
                });
                
                if (info.promptCandidates && Array.isArray(info.promptCandidates) && info.promptCandidates.length > 0) {
                  info.promptCandidates.forEach((candidate, idx) => {
                    chrome.runtime.sendMessage({
                      action: 'debugLog',
                      level: 'info',
                      message: `URL ${info.index + 1}: プロンプト候補${idx + 1} - クラス名="${candidate.className}", 長さ=${candidate.textLength}`,
                      data: candidate
                    });
                  });
                } else if (info.index < 3) {
                  chrome.runtime.sendMessage({
                    action: 'debugLog',
                    level: 'warning',
                    message: `URL ${info.index + 1}: プロンプト候補が見つかりませんでした`,
                    data: { url: info.url, allDivsCount: info.allDivsCount }
                  });
                }
              }
            });
            // デバッグ情報をクリア
            window._sunoDebugInfo = [];
          } else {
            // デバッグ情報が保存されていない場合
            chrome.runtime.sendMessage({
              action: 'debugLog',
              level: 'warning',
              message: 'デバッグ情報が保存されていません',
              data: { urlsCount: urlsWithData.length, debugInfoExists: !!window._sunoDebugInfo }
            });
          }
          
          // デバッグ情報を送信（最初の3件のみ）
          urlsWithData.slice(0, 3).forEach((item, idx) => {
            chrome.runtime.sendMessage({
              action: 'debugLog',
              level: 'info',
              message: `URL ${idx + 1}: タイトル="${item.title}", プロンプト="${item.prompt.substring(0, 50)}...", 画像="${item.imageUrl ? 'あり' : 'なし'}"`,
              data: { url: item.url, title: item.title, promptLength: item.prompt.length, hasImage: !!item.imageUrl }
            });
          });
          
          // デバッグ情報をバックグラウンドに送信（コンソールではなく情報ウィンドウに表示）
          chrome.runtime.sendMessage({
            action: 'debugLog',
            level: 'success',
            message: `取得したURL数: ${urlsWithData.length}`,
            data: { 
              urlCount: urlsWithData.length,
              titlesFound: urlsWithData.filter(u => u.title).length,
              promptsFound: urlsWithData.filter(u => u.prompt).length,
              imagesFound: urlsWithData.filter(u => u.imageUrl).length
            }
          });
        } catch (e) {
          chrome.runtime.sendMessage({
            action: 'debugLog',
            level: 'error',
            message: `デバッグ情報送信エラー: ${e.message}`,
            data: { error: e.toString() }
          });
        }
      }, 100); // 100ms後に送信（確実に実行されるように）
      
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

