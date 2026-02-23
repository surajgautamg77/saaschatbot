import * as express from 'express';
import { getCompanyDetails, updateCompanySettings, } from '../controllers/company.js';
import { protect, requireRole } from '../middleware/auth.js';
import * as Prisma from '@prisma/client';

const router = express.Router();

router.get('/company', protect, getCompanyDetails);
router.put('/company/settings', protect, requireRole(Prisma.Role.OWNER), updateCompanySettings);

export { router as companyRouter };