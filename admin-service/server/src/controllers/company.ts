import * as express from 'express';
import prisma from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// This is for the admin panel to get company-level details (e.g., business hours).
export const getCompanyDetails = async (req: AuthenticatedRequest, res: express.Response) => {
    const companyId = req.user!.companyId;
    try {
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { 
                id: true, name: true, timeZone: true,
                businessHoursStart: true, businessHoursEnd: true,
            }
        });
        if (!company) return res.status(404).json({ message: 'Company not found.' });
        res.status(200).json(company);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch company details.' });
    }
};

// This handles SAVING company-level settings.
export const updateCompanySettings = async (req: AuthenticatedRequest, res: express.Response) => {
    const companyId = req.user!.companyId;
    const { timeZone, businessHoursStart, businessHoursEnd } = req.body;

    try {
        const updatedCompany = await prisma.company.update({
            where: { id: companyId },
            data: { 
                timeZone, 
                businessHoursStart: Number(businessHoursStart), 
                businessHoursEnd: Number(businessHoursEnd),
            }
        });
        res.status(200).json(updatedCompany);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update settings.' });
    }
};