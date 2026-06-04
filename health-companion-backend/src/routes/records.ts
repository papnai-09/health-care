import express from 'express';
import path from 'path';
import { recordsDb } from '../database';
import { ApiResponse, HealthRecord } from '../types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
router.use(authenticateToken);
const validRecordTypes: HealthRecord['type'][] = ['consultation', 'lab-report', 'vaccination', 'prescription'];
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const MAX_TEXT_FOR_SUMMARY = 12000;

type UploadedRecordFile = {
  name: string;
  type: string;
  size: number;
  base64: string;
  extractedText?: string;
};

type CreateRecordRequest = {
  title: string;
  description?: string;
  date: string;
  type: HealthRecord['type'];
  file?: UploadedRecordFile;
};

const cleanText = (value: unknown, maxLength = 500): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';

const cleanLongText = (value: unknown, maxLength = MAX_TEXT_FOR_SUMMARY): string =>
  typeof value === 'string'
    ? value
        .replace(/[^\S\r\n]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, maxLength)
    : '';

const sanitizeFileName = (name: string): string => {
  const baseName = path.basename(name || 'medical-record');
  return baseName.replace(/[^\w.\- ()]/g, '_').slice(0, 120) || 'medical-record';
};

const isAllowedFileType = (fileType: string, fileName: string): boolean => {
  const normalizedType = fileType.toLowerCase();
  const extension = path.extname(fileName).toLowerCase();
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/json',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.txt', '.csv', '.json', '.doc', '.docx'];

  return allowedTypes.includes(normalizedType) || allowedExtensions.includes(extension);
};

const saveUploadedFile = (recordId: string, file?: UploadedRecordFile) => {
  if (!file) return null;

  const fileName = sanitizeFileName(file.name);
  const fileType = cleanText(file.type || 'application/octet-stream', 120);
  const declaredSize = Number(file.size);
  const normalizedBase64 = String(file.base64 || '').includes(',') ? String(file.base64).split(',').pop() ?? '' : String(file.base64 || '');

  if (!fileName || !normalizedBase64) {
    throw new Error('Uploaded file is missing file data');
  }

  if (!isAllowedFileType(fileType, fileName)) {
    throw new Error('Only PDF, image, text, CSV, JSON, DOC, and DOCX files are supported');
  }

  const buffer = Buffer.from(normalizedBase64, 'base64');
  if (!buffer.length) {
    throw new Error('Uploaded file could not be decoded');
  }

  if (buffer.length > MAX_UPLOAD_BYTES || declaredSize > MAX_UPLOAD_BYTES) {
    throw new Error('File size must be 6 MB or less');
  }

  return {
    fileName,
    fileType,
    fileSize: buffer.length,
    fileDataBase64: buffer.toString('base64'),
    fileUrl: `/api/records/${recordId}/file`,
  };
};

// GET /api/records - Get records for authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' } as ApiResponse<null>);
    }

    const records = await recordsDb.getByUserId(userId);
    const response: ApiResponse<HealthRecord[]> = {
      success: true,
      data: records
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching health records:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch health records'
    };
    res.status(500).json(response);
  }
});

// GET /api/records/:id/file - Download attached health record file
router.get('/:id/file', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' } as ApiResponse<null>);
    }

    const record = await recordsDb.getById(id);
    if (!record || record.userId !== userId || !record.fileDataBase64) {
      return res.status(404).json({ success: false, error: 'Attached file not found' } as ApiResponse<null>);
    }

    const fileBuffer = Buffer.from(record.fileDataBase64, 'base64');
    res.setHeader('Content-Type', record.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${sanitizeFileName(record.fileName || 'medical-record')}"`);
    res.send(fileBuffer);
  } catch (error) {
    console.error('Error downloading health record file:', error);
    res.status(500).json({ success: false, error: 'Failed to download attached file' } as ApiResponse<null>);
  }
});

// GET /api/records/:id - Get record by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' } as ApiResponse<null>);
    }

    const record = await recordsDb.getById(id);
    if (!record || record.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Health record not found' } as ApiResponse<null>);
    }

    const response: ApiResponse<HealthRecord> = {
      success: true,
      data: record
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching health record:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch health record'
    };
    res.status(500).json(response);
  }
});

// POST /api/records - Create new health record
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { title, description = '', date, type, file }: CreateRecordRequest = req.body;
    const cleanTitle = cleanText(title, 140);
    const cleanDescription = cleanLongText(description, 3000);

    if (!userId || !cleanTitle || !date || !type) {
      return res.status(400).json({ success: false, error: 'Title, date, and type are required' } as ApiResponse<null>);
    }

    if (!validRecordTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid health record type' } as ApiResponse<null>);
    }

    if (!cleanDescription && !file) {
      return res.status(400).json({ success: false, error: 'Add notes or upload a file for this record' } as ApiResponse<null>);
    }

    const recordId = Date.now().toString();
    let savedFile: ReturnType<typeof saveUploadedFile> = null;
    try {
      savedFile = saveUploadedFile(recordId, file);
    } catch (error) {
      return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Invalid uploaded file' } as ApiResponse<null>);
    }

    const aiSummary = await generateRecordSummary({
      title: cleanTitle,
      description: cleanDescription,
      date: cleanText(date, 24),
      type,
      fileName: savedFile?.fileName,
      fileType: savedFile?.fileType,
      extractedText: cleanLongText(file?.extractedText, MAX_TEXT_FOR_SUMMARY),
    });

    const newRecord: HealthRecord = {
      id: recordId,
      userId,
      title: cleanTitle,
      description: cleanDescription || (savedFile ? `Uploaded medical document: ${savedFile.fileName}` : ''),
      date,
      type,
      aiSummary,
      ...savedFile,
      createdAt: new Date().toISOString()
    };

    const created = await recordsDb.create(newRecord);
    const response: ApiResponse<HealthRecord> = {
      success: true,
      data: created,
      message: 'Health record created successfully'
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating health record:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to create health record'
    };
    res.status(500).json(response);
  }
});

// PUT /api/records/:id - Update health record
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const updates = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' } as ApiResponse<null>);
    }

    const record = await recordsDb.getById(id);
    if (!record || record.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Health record not found' } as ApiResponse<null>);
    }

    const updated = await recordsDb.update(id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Health record not found' } as ApiResponse<null>);
    }

    const response: ApiResponse<HealthRecord> = {
      success: true,
      data: updated,
      message: 'Health record updated successfully'
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating health record:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to update health record'
    };
    res.status(500).json(response);
  }
});

// DELETE /api/records/:id - Delete health record
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' } as ApiResponse<null>);
    }

    const record = await recordsDb.getById(id);
    if (!record || record.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Health record not found' } as ApiResponse<null>);
    }

    const deleted = await recordsDb.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Health record not found' } as ApiResponse<null>);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: 'Health record deleted successfully'
    };
    res.json(response);
  } catch (error) {
    console.error('Error deleting health record:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to delete health record'
    };
    res.status(500).json(response);
  }
});

async function generateRecordSummary(input: {
  title: string;
  description: string;
  date: string;
  type: HealthRecord['type'];
  fileName?: string;
  fileType?: string;
  extractedText?: string;
}): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    return generateFallbackSummary(input);
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content:
              'You summarize uploaded medical records for a patient dashboard. Do not diagnose, prescribe medicine, or invent values. Use only the supplied notes/extracted text. If the document text is not readable, say that clearly. Keep the summary concise, professional, and easy for a patient to review. Include: Summary, Key details, Follow-up points.',
          },
          {
            role: 'user',
            content: buildSummaryPrompt(input),
          },
        ],
        max_completion_tokens: Number(process.env.GROQ_RECORD_MAX_TOKENS ?? process.env.GROQ_MAX_TOKENS ?? 450),
        temperature: Number(process.env.GROQ_TEMPERATURE ?? 0.35),
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq record summary response not OK: ${response.status}`);
    }

    const result = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return result.choices?.[0]?.message?.content?.trim() || generateFallbackSummary(input);
  } catch (error) {
    console.warn('Groq record summary failed, using fallback:', error);
    return generateFallbackSummary(input);
  }
}

function buildSummaryPrompt(input: {
  title: string;
  description: string;
  date: string;
  type: HealthRecord['type'];
  fileName?: string;
  fileType?: string;
  extractedText?: string;
}) {
  return [
    `Record title: ${input.title}`,
    `Record type: ${input.type}`,
    `Record date: ${input.date}`,
    `Uploaded file: ${input.fileName || 'No file attached'}`,
    `File type: ${input.fileType || 'Not provided'}`,
    `Patient/doctor notes: ${input.description || 'Not provided'}`,
    '',
    'Extracted readable document text:',
    input.extractedText || 'No readable document text was available from the upload.',
  ].join('\n');
}

function generateFallbackSummary(input: {
  title: string;
  description: string;
  type: HealthRecord['type'];
  fileName?: string;
  extractedText?: string;
}): string {
  const sourceText = input.extractedText || input.description;
  if (sourceText) {
    const preview = sourceText.replace(/\s+/g, ' ').trim().slice(0, 520);
    return [
      'Summary: AI review saved the available readable content for this medical record.',
      `Key details: ${preview}${sourceText.length > 520 ? '...' : ''}`,
      'Follow-up points: Review the original document and discuss abnormal values, medication changes, or unclear findings with a qualified healthcare professional.',
    ].join('\n');
  }

  if (input.fileName) {
    return [
      'Summary: The medical file was uploaded successfully, but no readable text could be extracted automatically.',
      `Key details: File attached - ${input.fileName}; record type - ${input.type}.`,
      'Follow-up points: Open the attached document or add notes for a more detailed AI summary.',
    ].join('\n');
  }

  return 'Summary: Record saved. Add clinical notes or upload a document to generate a more detailed AI summary.';
}

export { router as recordsRouter };
