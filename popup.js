// トースト表示
function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');

    // エラーメッセージはより目立つスタイルに
    if (isError) {
        t.classList.add('error');
    } else {
        t.classList.remove('error');
    }

    setTimeout(() => {
        t.classList.remove('show');
        t.classList.remove('error');
    }, 3000); // 表示時間を長くする
}

// アラート表示（より目立つ通知）
function showAlert(message) {
    // すでにアラートがあれば削除
    const existingAlert = document.getElementById('alert-box');
    if (existingAlert) {
        existingAlert.remove();
    }

    // アラート要素を作成
    const alertBox = document.createElement('div');
    alertBox.id = 'alert-box';
    alertBox.className = 'alert';
    alertBox.innerHTML = `
        <div class="alert-content">
            <span class="alert-icon">⚠️</span>
            <span class="alert-message">${message}</span>
            <button class="alert-close">×</button>
        </div>
    `;

    // アラートを表示
    document.body.appendChild(alertBox);

    // 閉じるボタンのイベント
    const closeBtn = alertBox.querySelector('.alert-close');
    closeBtn.onclick = () => {
        alertBox.remove();
    };

    // 10秒後に自動で消える
    setTimeout(() => {
        if (document.body.contains(alertBox)) {
            alertBox.remove();
        }
    }, 10000);
}

// デバッグログ
function debugLog(message) {
    console.log(`[POPUP DEBUG] ${message}`);
}

// プロファイル一覧表示
async function refreshList() {
    debugLog(`プロファイル一覧を更新します`);

    // 全プロファイル情報を取得
    const response = await chrome.runtime.sendMessage({ action: 'getAllProfiles' });
    const profiles = response.profiles || [];
    const currentProfileName = response.currentProfileName;

    debugLog(`${profiles.length}個のプロファイルが見つかりました。現在のプロファイル: ${currentProfileName || 'なし'}`);

    // プロファイルリストを更新
    const profilesContainer = document.getElementById('profiles-container');
    profilesContainer.innerHTML = '';

    // 現在のアカウント情報
    const currentAccountInfo = document.createElement('div');
    currentAccountInfo.className = 'current-account-info';

    if (currentProfileName) {
        currentAccountInfo.innerHTML = `
            <div class="account-info-header">現在のアカウント</div>
            <div class="current-account-name">${currentProfileName}</div>
        `;
    } else {
        currentAccountInfo.innerHTML = `
            <div class="account-info-header">現在のアカウント</div>
            <div class="current-account-name no-account">ログイン中のアカウントは保存されていません</div>
        `;
    }

    profilesContainer.appendChild(currentAccountInfo);

    // 保存ボタン
    const saveButtonContainer = document.createElement('div');
    saveButtonContainer.className = 'action-button-container';
    saveButtonContainer.innerHTML = `
        <div class="input-group">
            <input type="text" id="profileName" placeholder="アカウント名（空欄で自動取得）" />
        </div>
        <button id="btnSaveCurrent" class="action-button save-button">
            <span class="button-icon">💾</span>
            <span class="button-text">現在のアカウントを保存</span>
        </button>
    `;
    profilesContainer.appendChild(saveButtonContainer);

    // 保存ボタンのイベント設定
    document.getElementById('btnSaveCurrent').onclick = async () => {
        let name = document.getElementById('profileName').value.trim();
        await saveCurrentProfile(name);
    };

    // 区切り線
    if (profiles.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'divider';
        profilesContainer.appendChild(divider);

        // 保存済みアカウント見出し
        const savedHeader = document.createElement('div');
        savedHeader.className = 'saved-accounts-header';
        savedHeader.textContent = '保存済みアカウント';
        profilesContainer.appendChild(savedHeader);

        // 保存済みアカウント一覧
        const accountsList = document.createElement('div');
        accountsList.className = 'accounts-list';

        profiles.forEach(name => {
            const accountItem = document.createElement('div');
            accountItem.className = 'account-item';

            // 現在使用中のアカウントにマーク
            if (name === currentProfileName) {
                accountItem.classList.add('current');
                accountItem.innerHTML = `
                    <div class="account-info">
                        <span class="account-name">${name}</span>
                        <span class="current-badge">使用中</span>
                    </div>
                    <div class="account-actions">
                        <button class="delete-btn" title="削除">🗑️</button>
                    </div>
                `;
            } else {
                accountItem.innerHTML = `
                    <div class="account-info">
                        <span class="account-name">${name}</span>
                    </div>
                    <div class="account-actions">
                        <button class="switch-btn" title="このアカウントに切替">切替</button>
                        <button class="delete-btn" title="削除">🗑️</button>
                    </div>
                `;

                // 切替ボタンのイベント設定
                const switchBtn = accountItem.querySelector('.switch-btn');
                switchBtn.onclick = () => loadProfile(name);
            }

            // 削除ボタンのイベント設定
            const deleteBtn = accountItem.querySelector('.delete-btn');
            deleteBtn.onclick = async () => {
                if (confirm(`アカウント「${name}」を削除してもよろしいですか？`)) {
                    const key = 'profile_' + name;
                    await chrome.storage.local.remove(key);
                    showToast(`${name} を削除しました`);
                    refreshList();
                }
            };

            accountsList.appendChild(accountItem);
        });

        profilesContainer.appendChild(accountsList);
    } else {
        // アカウントがない場合のメッセージ
        const noAccountsMsg = document.createElement('div');
        noAccountsMsg.className = 'no-accounts-message';
        noAccountsMsg.textContent = '保存されたアカウントはありません';
        profilesContainer.appendChild(noAccountsMsg);
    }
}

// クリエイター名を取得
async function getCreatorName() {
    try {
        debugLog(`クリエイター名の取得を開始します`);
        const response = await chrome.runtime.sendMessage({ action: 'getCreatorName' });
        debugLog(`クリエイター名の取得結果: ${response?.creatorName || 'null'}`);
        return response?.creatorName || null;
    } catch (error) {
        debugLog(`クリエイター名の取得エラー: ${error.message}`);
        return null;
    }
}

// プロファイルの保存
async function saveCurrentProfile(name) {
    // 名前が空の場合は自動取得を試みる
    if (!name) {
        showToast('クリエイター名を取得中...');

        // アカウント設定ページからクリエイター名を取得
        name = await getCreatorName();

        if (!name) {
            showToast('クリエイター名を取得できませんでした。手動で入力してください。', true);
            return;
        } else {
            // 取得した名前をフォームに設定
            document.getElementById('profileName').value = name;
            showToast(`クリエイター名「${name}」を取得しました`);
        }
    }

    debugLog(`プロファイル保存リクエスト: ${name}`);
    try {
        const response = await chrome.runtime.sendMessage({ action: 'save', name });
        if (response.ok) {
            showToast(`${name} を保存しました`);
            refreshList();
            return true;
        } else {
            showToast(`保存に失敗しました`, true);
            return false;
        }
    } catch (error) {
        debugLog(`プロファイル保存エラー: ${error.message}`);
        showToast(`保存に失敗しました: ${error.message}`, true);
        return false;
    }
}

// プロファイルの読み込み＆自動リロード
async function loadProfile(name) {
    if (!name) {
        showToast('プロファイルを選択してください', true);
        return;
    }

    debugLog(`プロファイル切替リクエスト: ${name}`);
    try {
        showToast(`${name} に切り替え中...`);
        const response = await chrome.runtime.sendMessage({ action: 'load', name });
        if (response.ok) {
            showToast(`${name} に切替完了`);

            // 現在のタブをリロード
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                chrome.tabs.reload(tabs[0].id);
            });

            // リストを更新
            refreshList();
            return true;
        } else {
            showToast(`切替に失敗しました`, true);
            return false;
        }
    } catch (error) {
        debugLog(`プロファイル切替エラー: ${error.message}`);
        showToast(`切替に失敗しました: ${error.message}`, true);
        return false;
    }
}

// CSSの追加
function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 15px;
            width: 340px;
            color: #333;
        }
        
        .alert {
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            background: #ffcc00;
            border: 1px solid #e6b800;
            border-radius: 4px;
            z-index: 1000;
        }
        
        .alert-content {
            display: flex;
            align-items: center;
            padding: 10px;
        }
        
        .alert-icon {
            margin-right: 10px;
            font-size: 1.2em;
        }
        
        .alert-message {
            flex: 1;
        }
        
        .alert-close {
            background: none;
            border: none;
            font-size: 1.2em;
            cursor: pointer;
            padding: 0 5px;
        }
        
        #toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            opacity: 0;
            transition: opacity 0.3s;
            z-index: 1000;
        }
        
        #toast.show {
            opacity: 1;
        }
        
        #toast.error {
            background: #ff3333;
        }
        
        .current-account-info {
            margin-bottom: 15px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 6px;
        }
        
        .account-info-header {
            font-size: 0.85em;
            color: #666;
            margin-bottom: 5px;
        }
        
        .current-account-name {
            font-size: 1.1em;
            font-weight: bold;
            color: #0066cc;
        }
        
        .current-account-name.no-account {
            color: #999;
            font-style: italic;
            font-weight: normal;
            font-size: 0.95em;
        }
        
        .input-group {
            margin-bottom: 10px;
        }
        
        #profileName {
            width: calc(100% - 20px);
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .action-button-container {
            margin-bottom: 15px;
        }
        
        .action-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            padding: 10px;
            border: none;
            border-radius: 4px;
            background: #0066cc;
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .action-button:hover {
            background: #0055aa;
        }
        
        .button-icon {
            margin-right: 8px;
        }
        
        .save-button {
            background: #28a745;
        }
        
        .save-button:hover {
            background: #218838;
        }
        
        .divider {
            height: 1px;
            background: #eee;
            margin: 15px 0;
        }
        
        .saved-accounts-header {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .accounts-list {
            margin-bottom: 15px;
        }
        
        .account-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #eee;
        }
        
        .account-item:last-child {
            border-bottom: none;
        }
        
        .account-item.current {
            background: #f0f8ff;
        }
        
        .account-info {
            display: flex;
            align-items: center;
        }
        
        .account-name {
            font-weight: 500;
        }
        
        .current-badge {
            font-size: 0.75em;
            background: #e6f2ff;
            color: #0066cc;
            padding: 2px 6px;
            border-radius: 3px;
            margin-left: 8px;
        }
        
        .account-actions {
            display: flex;
            gap: 5px;
        }
        
        .switch-btn, .delete-btn {
            padding: 4px 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            font-size: 12px;
        }
        
        .switch-btn {
            background: #e6f2ff;
            color: #0066cc;
            border-color: #0066cc;
        }
        
        .switch-btn:hover {
            background: #0066cc;
            color: white;
        }
        
        .delete-btn {
            background: white;
            color: #666;
        }
        
        .delete-btn:hover {
            background: #ffeeee;
            color: #cc0000;
            border-color: #cc0000;
        }
        
        .no-accounts-message {
            color: #999;
            font-style: italic;
            text-align: center;
            padding: 15px 0;
        }
        
        .instructions {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
            border-left: 4px solid #0066cc;
        }
        
        .instructions h3 {
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 16px;
            color: #0066cc;
        }
        
        .instruction-step {
            margin-bottom: 10px;
        }
        
        .step-number {
            display: inline-block;
            width: 20px;
            height: 20px;
            background: #0066cc;
            color: white;
            border-radius: 50%;
            text-align: center;
            font-size: 12px;
            line-height: 20px;
            margin-right: 8px;
        }
        
        .step-title {
            font-weight: bold;
        }
        
        .step-description {
            margin-left: 28px;
            font-size: 13px;
            color: #666;
            margin-top: 4px;
        }
    `;
    document.head.appendChild(style);
}

// 詳細な使い方説明を追加
function addInstructions() {
    const div = document.createElement('div');
    div.className = 'instructions';
    div.innerHTML = `
        <h3>📝 使い方ガイド</h3>
        
        <div class="instruction-step">
            <span class="step-number">1</span>
            <span class="step-title">アカウントの保存</span>
            <div class="step-description">
                Note.comにログイン後、上部の「現在のアカウントを保存」ボタンを押します。
                アカウント名は手動入力するか、空欄のままで自動取得できます。
            </div>
        </div>
        
        <div class="instruction-step">
            <span class="step-number">2</span>
            <span class="step-title">別アカウントの追加</span>
            <div class="step-description">
                Note.comでログアウトし、別のアカウントでログイン後、同様に保存します。
                複数のアカウントを保存できます。
            </div>
        </div>
        
        <div class="instruction-step">
            <span class="step-number">3</span>
            <span class="step-title">アカウントの切り替え</span>
            <div class="step-description">
                「保存済みアカウント」リストから切り替えたいアカウントの「切替」ボタンをクリックするだけ。
                ログアウト不要で即座に切り替わります。
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

// ポップアップが開かれたときの初期化
document.addEventListener('DOMContentLoaded', async () => {
    debugLog(`ポップアップが開かれました`);

    // 必要なDOM要素を追加
    const container = document.createElement('div');
    container.id = 'profiles-container';
    document.body.appendChild(container);

    // トースト要素の追加
    const toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);

    // スタイルを追加
    addStyles();

    // 使い方説明を追加
    addInstructions();

    // 一覧更新
    await refreshList();
});
