import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as process from 'process';
import { createServer } from 'http';
import { apiRouter } from './api/index.js';
import prisma from './db.js';
// import { cleanupExpiredSessions } from './controllers/live.js';
import { initializeWebSocket } from './websocket.js';
import { startSessionInactivityCheck, startOldMessageCleanup } from './cron.js';
import * as multer from 'multer';
import * as path from 'path'; // Import path module
import * as url from 'url'; // Import url module
import * as os from 'os';

// Get __dirname equivalent in ES modules
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to get local network IP
const getNetworkIp = () => {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]!) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return null;
};

const dotenvPath = path.resolve(__dirname, '../../.env');
console.log('Attempting to load .env from:', dotenvPath);
dotenv.config({ path: dotenvPath });
console.log('Current working directory:', process.cwd());
console.log('DATABASE_URL after dotenv.config():', process.env.DATABASE_URL);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 7003;

const main = async () => {
    initializeWebSocket(httpServer);
    startSessionInactivityCheck(prisma); // Pass the prisma client
    startOldMessageCleanup(prisma);      // Daily cleanup of old chat messages

    app.set('trust proxy', true);
    app.use(cors());
    app.use(express.json({ limit: '100mb' }));

    app.use('/server/api', apiRouter);

    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            let limit = 'N/A';
            // Check for knowledge base upload path
            if (req.path.includes('/knowledge/upload')) {
                limit = '10MB';
            } 
            // Check for bot logo upload path
            else if (req.path.includes('/logo')) {
                limit = '2MB';
            }
            res.status(400).json({ message: `File size exceeds the limit (max ${limit}).` });
        } else {
            console.error(err);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    });

    // const HEARTBEAT_TTL_SECONDS = 30;
    // setInterval(cleanupExpiredSessions, HEARTBEAT_TTL_SECONDS * 1000);

    httpServer.listen(Number(PORT), '0.0.0.0', () => {
      const networkIp = getNetworkIp();
      console.log(`🚀 Backend server is running`);
      console.log(`   ➜  Local:   http://localhost:${PORT}`);
      if (networkIp) {
        console.log(`   ➜  Network: http://${networkIp}:${PORT}`);
      }
    });
};

main().catch(err => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
