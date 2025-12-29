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
listBtn.addEventListener('click', loadFileList);
window.addEventListener('load', function() {
    loadFileList();
});

let selectedFiles = [];

function handleFiles(files) {
    selectedFiles = Array.from(files);
    renderFileList();
    loadFileList();  // ← Автоматический вызов при загрузке файлов
    messageBox.innerHTML = '';
}

// Функция для экранирования HTML
function escapeHtml(text) {
	const map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	};
	return text.replace(/[&<>"']/g, m => map[m]);
}

// Функция удаления файла
async function deleteFile(filename) {
	if (!confirm(`Вы уверены, что хотите удалить файл "${filename}"?`)) {
		return;
	}

	try {
		const response = await fetch('/api/delete', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: 'filename=' + encodeURIComponent(filename)
		});

		const data = await response.json();

		if (!response.ok) {
			messageBox.innerHTML = `<div class="error-box">❌ Ошибка: ${escapeHtml(data.error)}</div>`;
			return;
		}

		messageBox.innerHTML = `<div class="success-box">✓ Файл "${escapeHtml(filename)}" успешно удален</div>`;
		listFiles();
	} catch (error) {
		messageBox.innerHTML = `<div class="error-box">❌ Ошибка: ${escapeHtml(error.message)}</div>`;
	}
}

// Функция получения списка файлов
async function listFiles() {
	try {
		const response = await fetch('/api/list');
		const data = await response.json();

		if (data.error) {
			commandMessage.textContent = '❌ ' + data.error;
			outputBox.style.display = 'none';
			return;
		}
		
		commandMessage.textContent = '📁 Список файлов в uploads:';
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
			<span class="file-icon">📄</span>
			<div class="file-info">
				<div class="file-name">${escapeHtml(file.name)}</div>
				<div class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
			</div>
			<button class="btn-remove" onclick="removeFile(${index})">✕</button>
		`;
		fileList.appendChild(fileItem);
	});
}

function removeFile(index) {
	selectedFiles.splice(index, 1);
	renderFileList();
}

uploadBtn.addEventListener('click', uploadFiles);
clearBtn.addEventListener('click', () => {
	selectedFiles = [];
	renderFileList();
	messageBox.innerHTML = '';
});
listBtn.addEventListener('click', listFiles);
updateAPP.addEventListener('click', () => executeCommand('/api/update', 'Update'));
backupAPP.addEventListener('click', () => executeCommand('/api/backupAPP', 'Backup APP'));
restoreAPP.addEventListener('click', () => executeCommand('/api/restoreAPP', 'Restore APP'));
backupBD.addEventListener('click', () => executeCommand('/api/backupBD', 'Backup BD'));

async function uploadFiles() {
	if (selectedFiles.length === 0) {
		messageBox.innerHTML = '<div class="error-box">❌ Выберите файлы для загрузки</div>';
		return;
	}

	const formData = new FormData();
	selectedFiles.forEach(file => {
		formData.append('files', file);
	});

	try {
		uploadBtn.disabled = true;
		const response = await fetch('/api/upload', {
			method: 'POST',
			body: formData
		});

		const data = await response.json();

		if (data.error) {
			messageBox.innerHTML = `<div class="error-box">❌ Ошибка: ${escapeHtml(data.error)}</div>`;
			return;
		}

		messageBox.innerHTML = `<div class="success-box">✓ Загружено файлов: ${data.uploaded}</div>`;
		selectedFiles = [];
		renderFileList();
		messageBox.innerHTML += '<div class="info-box">ℹ️ Файлы загружены успешно!</div>';
	} catch (error) {
		messageBox.innerHTML = `<div class="error-box">❌ Ошибка загрузки: ${escapeHtml(error.message)}</div>`;
	} finally {
		uploadBtn.disabled = false;
	}
}

async function executeCommand(endpoint, commandName) {
	try {
		const response = await fetch(endpoint);
		const data = await response.json();

		if (data.error) {
			commandMessage.textContent = '❌ ' + data.error;
			outputBox.style.display = 'none';
			return;
		}

		commandMessage.textContent = `✓ ${commandName} выполнена успешно`;
		commandOutput.textContent = data.output;
		outputBox.style.display = 'block';
	} catch (error) {
		commandMessage.textContent = '❌ Ошибка: ' + error.message;
		outputBox.style.display = 'block';
	}
}

// Функция для автоматического показа списка файлов
async function loadFileList() {
    try {
        const response = await fetch('/api/list');
        const data = await response.json();
        
        if (response.ok && data.files && data.files.length > 0) {
            // Показать список файлов (ваш существующий код)
            showFileList(data.files);
            outputBox.style.display = 'block';
        } else {
            commandOutput.textContent = 'Нет файлов';
        }
    } catch (error) {
        commandOutput.textContent = '❌ Ошибка загрузки списка: ' + error.message;
        outputBox.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadFileList();  // ← Автоматический вызов при обновлении страницы
});
