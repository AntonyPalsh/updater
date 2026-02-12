const APP_CONFIG = {
    disabledButtons: {
        'updateAPP': true,   // true - кнопка заблокирована
        'backupAPP': false,  // false - кнопка активна
        'restoreAPP': true,
        'backupBD': false
    }
};

const upt_url_api_prefix = "";

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

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Функция инициализации блокировок
function applyButtonRestrictions() {
    Object.entries(APP_CONFIG.disabledButtons).forEach(([id, isDisabled]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = isDisabled;
            if (isDisabled) {
                btn.title = "Эта функция временно отключена";
            }
        }
    });
}

applyButtonRestrictions();

async function deleteFile(filename) {
    if (!confirm(`Вы уверены, что хотите удалить файл "${filename}"?`)) return;
    try {
        const response = await fetch(`${upt_url_api_prefix}/api/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'filename=' + encodeURIComponent(filename)
        });
        if (!response.ok) {
            const data = await response.json();
            messageBox.innerHTML = `<div class="error-box">${escapeHtml(data.error)}</div>`;
            return;
        }
        listFiles();
    } catch (error) {
        messageBox.innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
    }
}

// Функция получения списка файлов
async function listFiles() {
	try {
		const response = await fetch(`${upt_url_api_prefix}/api/list`);
		const data = await response.json();

		if (data.error) {
			commandMessage.textContent = '❌ ' + data.error;
			outputBox.style.display = 'none';
			return;
		}
		
		commandMessage.textContent = '📁 Список файлов в uloads:';
		outputBox.style.display = 'block';
		
		const lines = data.output.trim().split('\n');
		let html = '';
		
		lines.forEach(line => {
			line = line.trim();
			if (!line) return;
			
			const parts = line.split(/\s+/);
			if (parts.length >= 4) {
				const size = parts[0];
				const month = parts[1];
				const day = parts[2];
				const time = parts[3];
				const filename = parts.slice(4).join(' ');
				
				if (filename) {
					html += `<div class="file-item-row">
						<div class="file-item-info">
							<strong>${escapeHtml(filename)}</strong> • <small class="file-meta">${size} • ${month} ${day} ${time}</small>
						</div>
						<button class="btn-delete" onclick="deleteFile('${escapeHtml(filename).replace(/'/g, "\\'")}')">Удалить</button>
					</div>`;
				}
			}
		});
		
		commandOutput.innerHTML = html || '<p style="color: #999;">Нет файлов</p>';
	} catch (error) {
		commandMessage.textContent = '❌ Ошибка: ' + error.message;
		outputBox.style.display = 'block';
	}
}


uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

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
            <div class="file-info">
                <span>${escapeHtml(file.name)}</span>
                <small>${(file.size / (1024 * 1024)).toFixed(2)} MB</small>
            </div>
            <button onclick="removeFile(${index})">✕</button>`;
        fileList.appendChild(fileItem);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
}

async function uploadFiles() {
    if (selectedFiles.length === 0) return;

    uploadBtn.disabled = true;
    const originalText = uploadBtn.innerText;
    uploadBtn.innerText = 'Загрузка...';
    
    // Используем классы из CSS
    messageBox.innerHTML = `
        <div class="progress-wrapper">
            <div id="progressBar">0%</div>
        </div>`;
    const progressBar = document.getElementById('progressBar');

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percent + '%';
            progressBar.innerText = percent + '%';
        }
    });

    xhr.onload = function() {
        uploadBtn.disabled = false;
        uploadBtn.innerText = originalText;
        if (xhr.status >= 200 && xhr.status < 300) {
            messageBox.innerHTML = '<div class="success-box">Готово</div>';
            selectedFiles = [];
            renderFileList();
        } else {
            messageBox.innerHTML = '<div class="error-box">Ошибка сервера</div>';
        }
    };

    xhr.onerror = () => {
        uploadBtn.disabled = false;
        uploadBtn.innerText = originalText;
        messageBox.innerHTML = '<div class="error-box">Ошибка сети</div>';
    };

    xhr.open('POST', `${upt_url_api_prefix}/api/upload`);
    xhr.send(formData);
}

uploadBtn.addEventListener('click', uploadFiles);
clearBtn.addEventListener('click', () => { selectedFiles = []; renderFileList(); messageBox.innerHTML = ''; });
listBtn.addEventListener('click', listFiles);

async function executeCommand(endpoint, name, button) {
    // Блокируем кнопку
    button.disabled = true;
    const originalText = button.innerText;
    button.innerText = 'Выполняется...';
    
    try {
        const response = await fetch(endpoint);
        const data = await response.json();
        commandMessage.textContent = name + ':';
        commandOutput.textContent = data.output || data.error;
        outputBox.style.display = 'block';
    } catch (e) {
        commandMessage.textContent = 'Ошибка';
        commandOutput.textContent = e.message;
        outputBox.style.display = 'block';
    } finally {
        // Разблокируем кнопку после получения ответа
        button.disabled = false;
        button.innerText = originalText;
    }
}

// Обновляем обработчики событий для всех кнопок
updateAPP.addEventListener('click', () => executeCommand(`${upt_url_api_prefix}/api/update`, 'Обновление', updateAPP));
backupAPP.addEventListener('click', () => executeCommand(`${upt_url_api_prefix}/api/backupAPP`, 'Бэкап APP', backupAPP));
restoreAPP.addEventListener('click', () => executeCommand(`${upt_url_api_prefix}/api/restoreAPP`, 'Восстановление', restoreAPP));
backupBD.addEventListener('click', () => executeCommand(`${upt_url_api_prefix}/api/backupBD`, 'Бэкап БД', backupBD));