document.addEventListener('DOMContentLoaded', () => {
    const profileName = document.getElementById('profileName');
    const btnSave = document.getElementById('btnSave');
    const btnLoad = document.getElementById('btnLoad');

    btnSave.addEventListener('click', () => {
        const name = profileName.value.trim();
        if (!name) {
            alert('プロファイル名を入力してください');
            return;
        }
        chrome.runtime.sendMessage({ action: 'save', name }, (resp) => {
            if (resp && resp.ok) {
                alert('保存しました！');
            }
        });
    });

    btnLoad.addEventListener('click', () => {
        const name = profileName.value.trim();
        if (!name) {
            alert('プロファイル名を入力してください');
            return;
        }
        chrome.runtime.sendMessage({ action: 'load', name }, (resp) => {
            if (resp && resp.ok) {
                alert('切り替えました！');
            }
        });
    });
}); 