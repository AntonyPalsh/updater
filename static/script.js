const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const uploadBtn = document.getElementById('uploadBtn');
const clearBtn = document.getElementById('clearBtn');
const listBtn = document.getElementById('listBtn');
const actions = document.getElementById('actions');
const messageBox = document.getElementById('message');
const commandOutput = document.getElementById('commandOutput');
const outputBox = document.getElementById('outputBox');
const commandMessage = document.getElementById('commandMessage');
const updateAPP = document.getElementById('updateAPP');
const backupAPP = document.getElementById('backupAPP');
const restoreAPP = document.getElementById('restoreAPP');
const backupBD = document.getElementById('backupBD');

let selectedFiles = [];

// Upload zone handlers
uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    selectedFiles = Array.from(files);
    renderFileList();
    messageBox.innerHTML = '';
}

function renderFileList() {
    fileList.innerHTML = '';
    
    if (selectedFiles.length === 0) {
        actions.style.display = 'none';
        return;
    }

    actions.style.display = 'flex';

    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-icon">${getFileIcon(file.name)}</div>
            <div class="file-info">
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
        `;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-remove';
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', () => {
            selectedFiles.splice(index, 1);
            renderFileList();
        });
        fileItem.appendChild(removeBtn);

        fileList.appendChild(fileItem);
    });
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'zip': '🗜️', 'rar': '🗜️', '7z': '🗜️', 'tar': '🗜️', 'gz': '🗜️',
        'pdf': '📄', 'doc': '📝', 'docx': '📝', 'txt': '📄',
        'xls': '📊', 'xlsx': '📊', 'csv': '📊',
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
        'mp4': '🎥', 'avi': '🎥', 'mov': '🎥',
        'mp3': '🎵', 'wav': '🎵', 'flac': '🎵'
    };
    return iconMap[ext] || '📎';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

uploadBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        showMessage('Выберите файлы', 'error', messageBox);
        return;
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = '⏳ Загрузка...';

    const formData = new FormData();
    selectedFiles.forEach((file) => {
        formData.append('files', file);
    });

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            const fileList = selectedFiles.map(f => `• ${f.name}`).join('<br>');
            showMessage(`✓ Загружены файлы:<br>${fileList}`, 'success', messageBox);
            selectedFiles = [];
            renderFileList();
        } else {
            const error = await response.json();
            showMessage(`✗ Ошибка: ${error.error}`, 'error', messageBox);
        }
    } catch (error) {
        showMessage(`✗ Ошибка: ${error.message}`, 'error', messageBox);
    }

    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Загрузить файлы';
});

clearBtn.addEventListener('click', () => {
    selectedFiles = [];
    renderFileList();
    messageBox.innerHTML = '';
    fileInput.value = '';
});

// list
listBtn.addEventListener('click', async () => {
    listBtn.disabled = true;
    listBtn.textContent = '⏳ Выполнение...';
    commandMessage.innerHTML = '';

    try {
        const response = await fetch('/api/list', {
            method: 'GET'
        });

        const result = await response.json();

        if (response.ok) {
            commandOutput.textContent = result.output;
            outputBox.style.display = 'block';
            showMessage('✓ Успешно', 'success', commandMessage);
        } else {
            showMessage(`✗ Ошибка: ${result.error}`, 'error', commandMessage);
            commandOutput.textContent = result.output || 'Ошибка';
            outputBox.style.display = 'block';
        }
    } catch (error) {
        showMessage(`✗ Ошибка сети: ${error.message}`, 'error', commandMessage);
    }

    listBtn.disabled = false;
    listBtn.textContent = 'Список файлов';
});

function showMessage(text, type, element) {
    const boxClass = type === 'success' ? 'success-box' : type === 'error' ? 'error-box' : 'info-box';
    element.innerHTML = `<div class="${boxClass}">${text}</div>`;
}

// updateAPP
updateAPP.addEventListener('click', async () => {
    updateAPP.disabled = true;
    updateAPP.textContent = '⏳ Выполнение...';
    commandMessage.innerHTML = '';

    try {
        const response = await fetch('/api/update', {
            method: 'GET'
        });

        const result = await response.json();

        if (response.ok) {
            commandOutput.textContent = result.output;
            outputBox.style.display = 'block';
            showMessage('✓ Успешно', 'success', commandMessage);
        } else {
            showMessage(`✗ Ошибка: ${result.error}`, 'error', commandMessage);
            commandOutput.textContent = result.output || 'Ошибка';
            outputBox.style.display = 'block';
        }
    } catch (error) {
        showMessage(`✗ Ошибка сети: ${error.message}`, 'error', commandMessage);
    }

    updateAPP.disabled = false;
    updateAPP.textContent = 'Update APP';
});

// backupAPP
backupAPP.addEventListener('click', async () => {
    backupAPP.disabled = true;
    backupAPP.textContent = '⏳ Выполнение...';
    commandMessage.innerHTML = '';

    try {
        const response = await fetch('/api/backupAPP', {
            method: 'GET'
        });

        const result = await response.json();

        if (response.ok) {
            commandOutput.textContent = result.output;
            outputBox.style.display = 'block';
            showMessage('✓ Успешно', 'success', commandMessage);
        } else {
            showMessage(`✗ Ошибка: ${result.error}`, 'error', commandMessage);
            commandOutput.textContent = result.output || 'Ошибка';
            outputBox.style.display = 'block';
        }
    } catch (error) {
        showMessage(`✗ Ошибка сети: ${error.message}`, 'error', commandMessage);
    }

    backupAPP.disabled = false;
    backupAPP.textContent = 'Backup APP';
});

// restoreAPP
restoreAPP.addEventListener('click', async () => {
    restoreAPP.disabled = true;
    restoreAPP.textContent = '⏳ Выполнение...';
    commandMessage.innerHTML = '';

    try {
        const response = await fetch('/api/restoreAPP', {
            method: 'GET'
        });

        const result = await response.json();

        if (response.ok) {
            commandOutput.textContent = result.output;
            outputBox.style.display = 'block';
            showMessage('✓ Успешно', 'success', commandMessage);
        } else {
            showMessage(`✗ Ошибка: ${result.error}`, 'error', commandMessage);
            commandOutput.textContent = result.output || 'Ошибка';
            outputBox.style.display = 'block';
        }
    } catch (error) {
        showMessage(`✗ Ошибка сети: ${error.message}`, 'error', commandMessage);
    }

    restoreAPP.disabled = false;
    restoreAPP.textContent = 'Restore APP';
});

// backupBD
backupBD.addEventListener('click', async () => {
    backupBD.disabled = true;
    backupBD.textContent = '⏳ Выполнение...';
    commandMessage.innerHTML = '';

    try {
        const response = await fetch('/api/backupBD', {
            method: 'GET'
        });

        const result = await response.json();

        if (response.ok) {
            commandOutput.textContent = result.output;
            outputBox.style.display = 'block';
            showMessage('✓ Успешно', 'success', commandMessage);
        } else {
            showMessage(`✗ Ошибка: ${result.error}`, 'error', commandMessage);
            commandOutput.textContent = result.output || 'Ошибка';
            outputBox.style.display = 'block';
        }
    } catch (error) {
        showMessage(`✗ Ошибка сети: ${error.message}`, 'error', commandMessage);
    }

    backupBD.disabled = false;
    backupBD.textContent = 'Backup BD';
});