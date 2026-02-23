import * as express from 'express';
import prisma from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const getAllVisitors = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user!;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const skip = (page - 1) * pageSize;

    // For now, only SUPER_ADMIN can see all visitors across all companies.
    // We can expand this logic later if needed (e.g., for OWNERs to see their company's visitors).
    const whereClause: any = {};
    if (user.role !== 'SUPER_ADMIN') {
        // This part is tricky because a visitor is not directly linked to a company,
        // but through a session, which is linked to a bot, which is linked to a company.
        // For now, we will restrict this to SUPER_ADMIN to avoid complex queries.
        // A better approach would be to add companyId to the Visitor model.
        // But for now, let's keep it simple.
        // Let's allow OWNER and MANAGER to see visitors of their company.
        
        const sessions = await prisma.session.findMany({
            where: { companyId: user.companyId },
            select: { sessionId: true }
        });

        const sessionIds = sessions.map(s => s.sessionId);

        whereClause.sessionId = { in: sessionIds };
    }


    try {
        const [visitors, totalVisitors] = await prisma.$transaction([
            prisma.visitor.findMany({
                where: whereClause,
                orderBy: {
                    createdAt: 'desc',
                },
                include: {
                    session: {
                        select: {
                            bot: {
                                select: {
                                    name: true,
                                }
                            }
                        }
                    }
                },
                skip: skip,
                take: pageSize,
            }),
            prisma.visitor.count({ where: whereClause }),
        ]);

        return res.status(200).json({
            visitors,
            totalVisitors,
            page,
            pageSize,
            totalPages: Math.ceil(totalVisitors / pageSize),
        });
    } catch (err) {
        console.error('Error fetching visitors:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
