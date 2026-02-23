import * as express from 'express';
import * as multer from 'multer';
import * as fs from 'fs/promises';
import prisma from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { uuidv4 as cuid } from '../utils/uuid.js';

const upload = (multer as any).default({
  dest: 'uploads/temp',
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const getKnowledgeSources = async (req: AuthenticatedRequest, res: express.Response) => {
    const { botId } = req.params;
    const companyId = req.user!.companyId;
    try {
        const sources = await prisma.knowledgeSource.findMany({
            where: { botId, bot: { companyId } },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(sources);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch knowledge sources.' });
    }
};

export const uploadKnowledgeSource = [
    upload.array('files', 10),
    async (req: AuthenticatedRequest, res: express.Response) => {
        const { botId } = req.params;
        const companyId = req.user!.companyId;
        const tempFiles = req.files as Express.Multer.File[];

        if (!tempFiles || !tempFiles.length) {
            return res.status(400).json({ message: 'No files uploaded.' });
        }

        const bot = await prisma.bot.findFirst({ where: { id: botId, companyId } });
        if (!bot) return res.status(403).json({ message: 'Permission denied.' });

        // Step 1: Create all placeholder entries in the database first.
        const sourcePlaceholders = await Promise.all(tempFiles.map(tempFile => 
            prisma.knowledgeSource.create({
                data: {
                    fileName: tempFile.originalname,
                    fileType: tempFile.mimetype,
                    storagePath: 'pending',
                    botId: botId,
                }
            })
        ));

        try {
            // Step 2: Prepare a single FormData object with all files.
            const formData = new FormData();
            for (let i = 0; i < tempFiles.length; i++) {
                const tempFile = tempFiles[i];
                const fileBlob = new Blob([await fs.readFile(tempFile.path)]);
                formData.append('files', fileBlob, tempFile.originalname);
            }

            // Step 3: Send all files in one request to the third-party service.
            // We will use the ID of the first placeholder for the batch request.
            const thirdPartyServiceUrl = `${process.env.THIRD_PARTY_SERVICE_BASE_URL}/bots/${botId}/knowledge/upload`;

            const queryParams = new URLSearchParams();
            queryParams.append('knowledge_source_id', sourcePlaceholders[0].id);
            const fullUrl = `${thirdPartyServiceUrl}?${queryParams.toString()}`;

            const thirdPartyResponse = await fetch(fullUrl, {
                method: 'POST',
                body: formData,
            });

            if (!thirdPartyResponse.ok) {
                let errorData: any;
                try {
                    errorData = await thirdPartyResponse.json();
                } catch (jsonError) {
                    throw new Error(`Third-party service error: ${thirdPartyResponse.statusText}`);
                }
                throw new Error(`Third-party service error: ${errorData.message || thirdPartyResponse.statusText}`);
            }

            const responseData = await thirdPartyResponse.json();
            const { files } = responseData; // Expect 'files' array
            if (!files || !Array.isArray(files)) {
                throw new Error('Third-party service did not return a valid uploaded file array.');
            }

            // Step 4: Process the entire response array and update placeholders.
            const updatePromises = files.map(async (uploadedFile: { fileName: string, status: string, chunks: number }) => {
                const placeholder = sourcePlaceholders.find(p => p.fileName === uploadedFile.fileName);
                if (placeholder && uploadedFile.status === 'completed') {
                    // Update storagePath to indicate successful processing by ragai.
                    // The specific botId from the third-party is no longer provided in the response.
                    return prisma.knowledgeSource.update({
                        where: { id: placeholder.id },
                        data: { storagePath: `ragai:completed` }, // Indicate completion status
                    });
                }
                // If not found or not completed, resolve with null
                return Promise.resolve(null);
            });
            
            const successfulUploads = (await Promise.all(updatePromises)).filter(u => u !== null);
            
            // Step 5: Clean up any placeholder records that were NOT successfully updated.
            const successfulFileNames = new Set(successfulUploads.map(s => s.fileName));
            const failedPlaceholders = sourcePlaceholders.filter(p => !successfulFileNames.has(p.fileName));
            
            if (failedPlaceholders.length > 0) {
                await prisma.knowledgeSource.deleteMany({
                    where: { id: { in: failedPlaceholders.map(p => p.id) } }
                });
            }

            if (successfulUploads.length === 0) {
                throw new Error("None of the files were successfully processed by the third-party service.");
            }

            res.status(201).json({
                message: `Successfully processed ${successfulUploads.length} of ${tempFiles.length} files.`,
                successfulFiles: successfulUploads.map(s => ({
                    fileName: s.fileName,
                    id: s.id // Return the internal ID for tracking
                })),
                failedFiles: failedPlaceholders.map(p => p.fileName)
            });

        } catch (error) {
            // If the entire API call fails, delete all placeholders created for this batch.
            await prisma.knowledgeSource.deleteMany({
                where: { id: { in: sourcePlaceholders.map(p => p.id) } }
            });
            
            // Let the main error handler in index.ts catch this.
            // We re-throw it to ensure the response sent to the client reflects the failure.
            res.status(500).json({ message: error instanceof Error ? error.message : 'An unknown error occurred during upload processing.' });

        } finally {
            // Final cleanup of temporary files from disk.
            await Promise.all(tempFiles.map(tempFile => fs.unlink(tempFile.path).catch(e => console.warn(`Failed to delete temp file: ${tempFile.path}`, e))));
        }
    }
];

export const deleteKnowledgeSource = async (req: AuthenticatedRequest, res: express.Response) => {
    const { sourceId } = req.params;
    const companyId = req.user!.companyId;
    try {
        // More robust delete: ensure the source belongs to a bot within the user's company
        const deleted = await prisma.knowledgeSource.deleteMany({
            where: { id: sourceId, bot: { companyId } }
        });
        if (deleted.count === 0) return res.status(404).json({ message: 'File not found or permission denied.' });
        res.status(200).json({ message: 'File deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete file.' });
    }
};
