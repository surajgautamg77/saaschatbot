import * as express from 'express';
import prisma from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// All global settings controller functions have been removed as this is now handled on a per-bot basis.
