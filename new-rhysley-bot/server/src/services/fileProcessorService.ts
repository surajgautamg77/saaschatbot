import fs from 'fs/promises';
import mammoth from 'mammoth';
import { PDFExtract } from 'pdf.js-extract';
import ExcelJS from 'exceljs';

// --- NEW, MORE ROBUST CHUNKING FUNCTION ---
const chunkText = (text: string, maxChunkSize: number = 2000, overlapSize: number = 500): string[] => {
    const chunks: string[] = [];
    if (!text) {
        return chunks;
    }

    // Split the text into sentences. This is a more semantic unit than characters or lines.
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [];

    if (sentences.length === 0) {
        if (text.length > 0) chunks.push(text);
        return chunks;
    }

    let currentChunk = '';
    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (sentence.length === 0) continue;

        // If adding the next sentence exceeds the max chunk size, we need to finalize the current chunk.
        if ((currentChunk + ' ' + sentence).length > maxChunkSize) {
            // Push the completed chunk.
            chunks.push(currentChunk);

            // Start the next chunk with an overlap from the previous one.
            // Find the starting point for the overlap text.
            const overlapStart = Math.max(0, currentChunk.length - overlapSize);
            let overlapText = currentChunk.substring(overlapStart);

            // To avoid cutting a sentence in half, find the beginning of the sentence in the overlap.
            const firstSentenceInOverlapMatch = overlapText.match(/[^.!?]+[.!?]*/);
            if (firstSentenceInOverlapMatch && firstSentenceInOverlapMatch.index && firstSentenceInOverlapMatch.index > 0) {
                overlapText = overlapText.substring(firstSentenceInOverlapMatch.index);
            }

            currentChunk = overlapText;
        }

        // Add the sentence to the current chunk.
        currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
    }

    // Add the last remaining chunk if it exists.
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
};


export async function extractChunksFromFile(filePath: string, mimeType: string): Promise<string[]> {
    const buffer = await fs.readFile(filePath);

    switch (mimeType) {
        case 'application/pdf': {
            const pdfExtractor = new PDFExtract();
            const data = await pdfExtractor.extractBuffer(buffer);
            const fullText = data.pages.map(page => page.content.map(item => item.str).join(' ')).join('\n\n');
            return chunkText(fullText);
        }

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
            const docxResult = await mammoth.extractRawText({ buffer });
            return chunkText(docxResult.value);
        }

        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer as any);
            const chunks: string[] = [];

            workbook.eachSheet((worksheet) => {
                worksheet.eachRow((row, rowNumber) => {
                    // Skip header row
                    if (rowNumber === 1) return;

                    const rowAsObj: { [key: string]: string } = {};
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        const headerCell = worksheet.getCell(1, colNumber);
                        const header = headerCell.value ? headerCell.value.toString() : '';
                        if (header) {
                            const cellValue = cell.value ? cell.value.toString() : '';
                            if(cellValue) {
                                rowAsObj[header] = cellValue;
                            }
                        }
                    });

                    const rowText = Object.entries(rowAsObj)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join('\n');

                    if (rowText.trim()) {
                        chunks.push(rowText.trim());
                    }
                });
            });
            return chunks;
        }

        case 'text/plain':
        case 'text/markdown':
        case 'application/json': {
            const fullText = buffer.toString('utf8');
            return chunkText(fullText);
        }

        default:
            console.warn(`Unsupported file type: ${mimeType}. Skipping chunk extraction.`);
            return [];
    }
}