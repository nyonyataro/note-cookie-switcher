// トースト表示
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1500);
}

// プロファイル一覧＆削除ボタン表示
async function refreshList() {
    const all = await chrome.storage.local.get();
    const sel = document.getElementById('profileList');
    const ul = document.getElementById('profileItems');
    sel.innerHTML = '<option disabled>-- プロファイル選択 --</option>';
    ul.innerHTML = '';
    Object.keys(all)
        .filter(k => k.startsWith('profile_'))
        .forEach(key => {
            const name = key.replace('profile_', '');
            // セレクト用 option
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            sel.appendChild(opt);
            // 削除用 li+button
            const li = document.createElement('li');
            li.textContent = name;
            const btn = document.createElement('button');
            btn.textContent = '🗑️';
            btn.style.marginLeft = '6px';
            btn.onclick = async () => {
                await chrome.storage.local.remove(key);
                showToast(`${name} を削除しました`);
                refreshList();
            };
            li.appendChild(btn);
            ul.appendChild(li);
        });
}

// 保存
document.getElementById('btnSave').onclick = () => {
    const name = document.getElementById('profileName').value.trim();
    // ユーザーが名前を入力していなければ、アカウント設定ページから取得を試みる
    if (!name) {
        // アカウント設定ページからユーザー名を取得して保存するアクションを送信
        // 自動取得は機能しないため、手動入力を促すメッセージを表示
        showToast('プロファイル名を入力してね'); // メッセージを修正
        return;
    }

    // 名前が入力されていれば、その名前で保存
    chrome.runtime.sendMessage({ action: 'save', name }, r => {
        if (r.ok) { showToast(`${name} を保存`); refreshList(); }
    });
};

// 読み込み＋自動リロード
document.getElementById('btnLoad').onclick = () => {
    const name = document.getElementById('profileList').value;
    if (!name) return showToast('選択してね');
    chrome.runtime.sendMessage({ action: 'load', name }, r => {
        if (r.ok) {
            showToast(`${name} に切替完了`);
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                chrome.tabs.reload(tabs[0].id);
            });
        }
    });
};

// 初期表示
refreshList();
