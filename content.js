// content.js - Note.comのページ内で実行されるスクリプト

// デバッグログ
function debugLog(message) {
    console.log(`[CONTENT SCRIPT] ${message}`);
}

// クリエイター名の取得処理
function getCreatorName() {
    debugLog('クリエイター名の取得を試みます');

    // アカウント設定ページのみで取得を試みる
    if (window.location.href.includes('note.com/settings/account')) {
        // 指定されたCSSセレクタでアカウント名を取得
        const creatorNameElement = document.querySelector('#page > main > div > div.w-full.border-b.border-b-border-default.bg-background-primary.md\\:w-\\[38\\.75rem\\].md\\:rounded.md\\:border-b-0 > div > div:nth-child(1) > a:nth-child(1) > div.break-all > p');

        if (creatorNameElement) {
            const name = creatorNameElement.textContent.trim();
            debugLog(`指定のCSSセレクタからクリエイター名を取得: ${name}`);
            return name;
        }

        debugLog('指定のCSSセレクタでクリエイター名要素が見つかりませんでした');
    } else {
        debugLog('現在のページはアカウント設定ページではありません');
    }

    return null;
}

// バックグラウンドスクリプトからのメッセージ受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debugLog(`メッセージ受信: ${JSON.stringify(message)}`);

    if (message.action === 'getCreatorName') {
        const name = getCreatorName();
        sendResponse({ creatorName: name });
        return true;
    }
});

// ページロード時の処理
function onPageLoad() {
    debugLog(`ページがロードされました: ${window.location.href}`);

    // クリエイター名の自動検出
    const creatorName = getCreatorName();
    if (creatorName) {
        chrome.runtime.sendMessage({
            action: 'creatorNameDetected',
            creatorName: creatorName
        }).catch(error => {
            debugLog(`クリエイター名通知エラー: ${error.message}`);
        });
    }
}

// DOMロード時に初期化
document.addEventListener('DOMContentLoaded', onPageLoad);

// すでにDOMがロード済みの場合の対応
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    onPageLoad();
} 