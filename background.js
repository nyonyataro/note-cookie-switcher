// background.js

// 最後にプロファイルを保存したタイムスタンプ
let lastSaveTimestamp = 0;
const SAVE_DEBOUNCE_TIME = 1000; // 保存処理のデバウンス時間 (ミリ秒)

// 最後に保存した_note_session_v5のvalue
let lastSessionCookieValue = null;

// Cookie をまとめて取得→保存
async function saveProfile(name) {
    const cookies = await chrome.cookies.getAll({ domain: "note.com" });
    await chrome.storage.local.set({ ["profile_" + name]: cookies });
    console.log(`${name} プロファイルを保存しました🎉`);
}

// 現在のCookieを全削除
async function clearNoteCookies() {
    const cookies = await chrome.cookies.getAll({ domain: "note.com" });
    for (let c of cookies) {
        await chrome.cookies.remove({
            url: "https://note.com" + c.path,
            name: c.name
        });
    }
}

// 保存したプロフィールを復元
async function loadProfile(name) {
    const key = "profile_" + name;
    const { [key]: cookies } = await chrome.storage.local.get(key);
    if (!cookies) {
        console.warn("プロファイル未保存です👀");
        return;
    }
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
    console.log(`${name} プロファイルに切り替えました✨`);
}

// popup.js からのメッセージ受信
chrome.runtime.onMessage.addListener((msg, sender, resp) => {
    if (msg.action === "save") {
        saveProfile(msg.name).then(() => resp({ ok: true }));
        return true;  // 非同期レスポンス対応
    }
    if (msg.action === "load") {
        loadProfile(msg.name).then(() => resp({ ok: true }));
        return true;
    }
});

// Cookie 変更監視 → ログインを検知して自動作成
// chrome.cookies.onChanged.addListener(async info => {
// ... 削除するコード ...
// });
