// background.js

// 最後にプロファイルを保存したタイムスタンプ
let lastSaveTimestamp = 0;
const SAVE_DEBOUNCE_TIME = 1000; // 保存処理のデバウンス時間 (ミリ秒)

// 最後に保存した_note_session_v5のvalue
let lastSessionCookieValue = null;

// 最後に取得したクリエイター名
let lastDetectedCreatorName = null;

// ログイン状態のプロファイル名（現在アクティブなプロファイル）
let currentProfileName = null;

// デバッグログ
function debugLog(message) {
    const timestamp = new Date().toISOString();
    console.log(`[DEBUG ${timestamp}] ${message}`);
}

// 定数
const PROFILE_PREFIX = 'profile_';

// プロファイル名からストレージキーを生成
function getProfileKey(name) {
    return PROFILE_PREFIX + name;
}

// Cookie をまとめて取得→保存
async function saveProfile(name) {
    const cookies = await chrome.cookies.getAll({ domain: "note.com" });
    debugLog(`Cookie取得: ${cookies.length}個のCookieを取得しました`);

    // セッションCookieの確認
    const sessionCookie = cookies.find(c => c.name === "_note_session_v5");
    if (sessionCookie) {
        debugLog(`セッションCookie: ${sessionCookie.name}=${sessionCookie.value.substring(0, 10)}...`);
    } else {
        debugLog(`警告: セッションCookieが見つかりません！`);
    }

    // プロファイルキーを生成
    const key = getProfileKey(name);

    // 保存
    await chrome.storage.local.set({ [key]: cookies });
    currentProfileName = name; // 現在のプロファイル名を記録
    debugLog(`プロファイル保存完了: ${name}`);
}

// 現在のCookieを全削除
async function clearNoteCookies() {
    const cookies = await chrome.cookies.getAll({ domain: "note.com" });
    debugLog(`Cookie削除開始: ${cookies.length}個のCookieを削除します`);

    for (let c of cookies) {
        await chrome.cookies.remove({
            url: "https://note.com" + c.path,
            name: c.name
        });
    }

    debugLog(`Cookie削除完了`);
}

// 保存したプロファイルを復元
async function loadProfile(name) {
    // プロファイルキーを生成
    const key = getProfileKey(name);
    debugLog(`プロファイル読み込み開始: ${name}`);

    const { [key]: cookies } = await chrome.storage.local.get(key);
    if (!cookies) {
        console.warn("プロファイル未保存です👀");
        return;
    }

    debugLog(`プロファイル読み込み: ${cookies.length}個のCookieを復元します`);

    await clearNoteCookies();
    for (let c of cookies) {
        await chrome.cookies.set({
            url: "https://note.com" + c.path,
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            secure: c.secure,
            httpOnly: c.httpOnly,
            sameSite: c.sameSite
        });
    }

    currentProfileName = name; // 現在のプロファイル名を記録
    debugLog(`プロファイル切替完了: ${name}`);
}

// プロファイルの検証（セッションCookieのみを確認し、存在しなければ無効と判断）
async function validateProfile(profileName) {
    if (!profileName) return false;

    debugLog(`プロファイル検証: ${profileName}`);

    // プロファイルキーを生成
    const key = getProfileKey(profileName);

    // プロファイルの存在を確認
    const { [key]: cookies } = await chrome.storage.local.get(key);
    if (!cookies || !Array.isArray(cookies)) {
        debugLog(`プロファイル ${profileName} は存在しません`);
        return false;
    }

    // セッションCookieの存在を確認
    const sessionCookie = cookies.find(c => c.name === "_note_session_v5");
    if (!sessionCookie) {
        debugLog(`プロファイル ${profileName} にはセッションCookieが存在しません`);
        return false;
    }

    debugLog(`プロファイル ${profileName} は有効です`);
    return true;
}

// アカウント設定ページからクリエイター名を取得する
async function getCreatorName() {
    try {
        // 現在のタブを取得
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) return null;

        const tab = tabs[0];

        // 現在のURLがアカウント設定ページでない場合は、そのページに遷移
        if (!tab.url.includes('note.com/settings/account')) {
            debugLog('アカウント設定ページに遷移します');
            await chrome.tabs.update(tab.id, { url: 'https://note.com/settings/account' });

            // 完全に読み込まれるのを待つ
            debugLog('ページの読み込みを待機しています...');
            await new Promise(resolve => {
                const checkLoaded = async (tabId, changeInfo) => {
                    if (tabId === tab.id && changeInfo.status === 'complete') {
                        debugLog('ページの読み込みが完了しました');
                        chrome.tabs.onUpdated.removeListener(checkLoaded);

                        // DOMが完全に構築されるまで少し待機
                        await new Promise(r => setTimeout(r, 2000));
                        resolve();
                    }
                };

                chrome.tabs.onUpdated.addListener(checkLoaded);

                // タイムアウト（15秒で諦める）
                setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(checkLoaded);
                    debugLog('ページ読み込みのタイムアウト');
                    resolve();
                }, 15000);
            });
        }

        // コンテンツスクリプトにメッセージを送信
        debugLog('コンテンツスクリプトにクリエイター名取得を要求します');
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getCreatorName' });
        debugLog(`クリエイター名取得応答: ${JSON.stringify(response)}`);
        return response?.creatorName || null;
    } catch (error) {
        console.error('クリエイター名の取得に失敗しました:', error);
        return null;
    }
}

// popup.js からのメッセージ受信
chrome.runtime.onMessage.addListener((msg, sender, resp) => {
    debugLog(`メッセージ受信: action=${msg.action}`);

    if (msg.action === "save") {
        saveProfile(msg.name).then(() => resp({ ok: true }));
        return true;  // 非同期レスポンス対応
    }
    if (msg.action === "load") {
        loadProfile(msg.name).then(() => resp({ ok: true }));
        return true;
    }
    if (msg.action === "getCreatorName") {
        getCreatorName().then(name => resp({ creatorName: name }));
        return true;
    }
    if (msg.action === "creatorNameDetected") {
        // コンテンツスクリプトからクリエイター名を受け取った
        lastDetectedCreatorName = msg.creatorName;
        debugLog(`クリエイター名を検出: ${lastDetectedCreatorName}`);
        return true;
    }
    if (msg.action === "validateProfile") {
        // 現在のプロファイルの検証
        validateProfile(currentProfileName).then(isValid => {
            resp({ ok: true, isValid });
        });
        return true;
    }
    if (msg.action === "getCurrentProfile") {
        resp({ profileName: currentProfileName });
        return true;
    }
    if (msg.action === "getAllProfiles") {
        chrome.storage.local.get().then(all => {
            // プロファイルのみを抽出
            const profiles = Object.keys(all)
                .filter(k => k.startsWith(PROFILE_PREFIX) && !k.startsWith('_'))
                .map(k => k.replace(PROFILE_PREFIX, ''));

            resp({ profiles, currentProfileName });
        });
        return true;
    }
});

// Cookie 変更監視 → プロファイル状態を管理
chrome.cookies.onChanged.addListener(async info => {
    // note.comのCookieの変更のみを監視
    if (!info.cookie.domain.includes('note.com')) return;

    const cookieName = info.cookie.name;
    const isRemoved = info.removed;

    // セッションCookie関連の変更のみログに出力
    if (cookieName === "_note_session_v5") {
        debugLog(`Cookie変更: ${cookieName} が ${isRemoved ? '削除' : '追加/更新'} されました`);
    }
});

// 拡張機能起動時に現在のプロファイル状態を初期化
chrome.runtime.onStartup.addListener(() => {
    debugLog(`拡張機能起動: 現在のプロファイル状態を初期化します`);
    currentProfileName = null;
});
