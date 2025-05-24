// デバッグログ
function debugLog(message) {
    console.log(`[Note アカウント切替君 コンテンツスクリプト] ${message}`);
}

debugLog('コンテンツスクリプトが読み込まれました');

// アカウント設定ページからクリエイター名を取得する関数
function getCreatorName() {
    debugLog('クリエイター名の取得を試みます');

    const selector = '#page > main > div > div.w-full.border-b.border-b-border-default.bg-background-primary.md\\:w-\\[38\\.75rem\\].md\\:rounded.md\\:border-b-0 > div > div:nth-child(1) > a:nth-child(1) > div.break-all > p';
    const element = document.querySelector(selector);

    if (element) {
        const name = element.textContent.trim();
        debugLog(`クリエイター名を取得しました: ${name}`);
        return name;
    } else {
        debugLog('クリエイター名を取得できませんでした（要素が見つかりません）');

        // セレクターが変わった可能性があるため、代替の取得方法を試す
        try {
            // プロフィール画像や他の要素から推測
            const usernameElements = document.querySelectorAll('p.break-all');
            if (usernameElements && usernameElements.length > 0) {
                for (const el of usernameElements) {
                    if (el.textContent && el.textContent.trim()) {
                        const name = el.textContent.trim();
                        debugLog(`代替方法でクリエイター名を取得しました: ${name}`);
                        return name;
                    }
                }
            }

            debugLog('代替方法でもクリエイター名を取得できませんでした');
        } catch (error) {
            debugLog(`クリエイター名の取得中にエラーが発生しました: ${error.message}`);
        }

        return null;
    }
}

// ログアウト状態を検出する（複数の方法を組み合わせて信頼性を高める）
function detectLogoutState() {
    debugLog('ログアウト状態の検出を開始します');

    // 方法1: ログインリンクの存在
    const loginLinks = document.querySelectorAll('a[href*="/login"]');
    if (loginLinks && loginLinks.length > 0) {
        debugLog(`ログイン要素が見つかりました (${loginLinks.length}個) - ログアウト状態と判断します`);
        return true;
    }

    // 方法2: セッションCookieの有無
    const hasSessionCookie = document.cookie.includes('_note_session_v5');
    if (!hasSessionCookie) {
        debugLog('セッションCookieが見つかりません - ログアウト状態と判断します');
        return true;
    }

    // 方法3: ログイン状態でのみ表示される要素の有無をチェック
    const accountMenuElement = document.querySelector('a[href*="/settings"]');
    if (!accountMenuElement) {
        debugLog('アカウント設定リンクが見つかりません - ログアウト状態と判断します');
        return true;
    }

    // 追加のチェック: ページURLがログインページの場合
    if (window.location.pathname.includes('/login')) {
        debugLog('現在のページがログインページです - ログアウト状態と判断します');
        return true;
    }

    debugLog('ログイン状態と判断します');
    return false;
}

// 初期状態のログアウト検出を実行し、状態をバックグラウンドに送信
function checkAndReportLogoutState() {
    const isLoggedOut = detectLogoutState();

    if (isLoggedOut) {
        debugLog('ログアウト状態を検出しました - バックグラウンドに通知します');
        chrome.runtime.sendMessage({
            action: 'logoutDetected'
        }, response => {
            if (response && response.ok) {
                debugLog('ログアウト通知がバックグラウンドで処理されました');
            }
        });
    } else {
        debugLog('ログイン状態を検出しました');
    }
}

// バックグラウンドスクリプトからのメッセージリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debugLog(`メッセージを受信しました: action=${message.action}`);

    if (message.action === 'getCreatorName') {
        const creatorName = getCreatorName();
        debugLog(`クリエイター名の取得リクエストに応答: ${creatorName}`);
        sendResponse({ creatorName });
    }
    if (message.action === 'checkLogoutState') {
        const isLoggedOut = detectLogoutState();
        debugLog(`ログアウト状態チェックリクエストに応答: ${isLoggedOut}`);
        sendResponse({ isLoggedOut });
    }
    return true; // 非同期レスポンスのために必要
});

// ログアウトリンクを検出する（テキスト内容で検索）
function findLogoutLinks(element) {
    if (!element) return [];

    const results = [];

    // href属性にlogoutを含むリンクを検索
    const logoutLinks = element.querySelectorAll('a[href*="/logout"]');
    if (logoutLinks && logoutLinks.length > 0) {
        logoutLinks.forEach(link => results.push(link));
    }

    // テキスト内容が「ログアウト」のボタンやリンクを検索
    const allElements = element.querySelectorAll('a, button');
    allElements.forEach(el => {
        const text = el.textContent && el.textContent.trim();
        if (text && (text === 'ログアウト' || text.includes('ログアウト'))) {
            results.push(el);
        }
    });

    return results;
}

// DOMの変更を監視して、ログアウトボタンのクリックを検出
function setupLogoutButtonListener() {
    debugLog('ログアウトボタンの監視を開始します');

    // 初期状態でのログアウトリンクを検索
    const initialLogoutLinks = findLogoutLinks(document.body);
    if (initialLogoutLinks.length > 0) {
        debugLog(`初期状態で${initialLogoutLinks.length}個のログアウト要素を検出しました`);
        initialLogoutLinks.forEach(link => {
            link.addEventListener('click', () => {
                debugLog('ログアウトボタンがクリックされました');
                chrome.runtime.sendMessage({
                    action: 'logoutDetected',
                    source: 'button_click'
                });
            });
        });
    }

    // ログアウトボタンの可能性がある要素を探す
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        try {
                            // 追加された要素内のログアウトリンクを検索
                            const logoutLinks = findLogoutLinks(node);

                            if (logoutLinks.length > 0) {
                                debugLog(`新しく追加された要素内で${logoutLinks.length}個のログアウト要素を検出しました`);

                                logoutLinks.forEach(link => {
                                    link.addEventListener('click', () => {
                                        debugLog('ログアウトボタンがクリックされました');
                                        chrome.runtime.sendMessage({
                                            action: 'logoutDetected',
                                            source: 'button_click'
                                        });
                                    });
                                });
                            }
                        } catch (error) {
                            debugLog(`ログアウト要素の検索中にエラーが発生しました: ${error.message}`);
                        }
                    }
                }
            }
        }
    });

    // bodyの変更を監視（エラーハンドリング付き）
    try {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        debugLog('DOM変更の監視を開始しました');
    } catch (error) {
        debugLog(`DOM監視の開始に失敗しました: ${error.message}`);
    }
}

// ページ読み込み完了時の処理
window.addEventListener('load', () => {
    debugLog('ページ読み込みが完了しました');

    // クリエイター名の取得
    const creatorName = getCreatorName();
    if (creatorName) {
        debugLog(`取得したクリエイター名をバックグラウンドに送信します: ${creatorName}`);
        chrome.runtime.sendMessage({
            action: 'creatorNameDetected',
            creatorName
        });
    }

    // ログアウト状態の検出と通知
    setTimeout(() => {
        checkAndReportLogoutState();
    }, 1000); // 1秒遅延させて実行（ページが完全に読み込まれるのを待つ）

    // ログアウトボタンの監視（エラーハンドリング付き）
    try {
        setupLogoutButtonListener();
    } catch (error) {
        debugLog(`ログアウトボタン監視の設定に失敗しました: ${error.message}`);
    }
});
