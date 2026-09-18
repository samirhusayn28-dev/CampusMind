import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'gsk_mock_preview_key',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audioBase64, mimeType = 'audio/m4a', fileName = 'recording.m4a' } = req.body || {};

    if (!audioBase64) {
      return res.status(400).json({ error: 'Missing audioBase64 in request body' });
    }

    // Clean base64 string
    const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Write to a temporary file for Groq Whisper streaming
    const ext = path.extname(fileName) || '.m4a';
    const tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
    await fs.promises.writeFile(tempFilePath, buffer);

    try {
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-large-v3',
        response_format: 'verbose_json',
      });

      const text = transcription.text ? transcription.text.trim() : '';
      const wordCount = text ? text.split(/\s+/).length : 0;
      const durationSeconds = (transcription as any).duration || 0;

      return res.status(200).json({
        success: true,
        text,
        durationSeconds,
        wordCount,
      });
    } finally {
      // Clean up temp file safely
      try {
        if (fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath);
        }
      } catch (cleanupErr) {
        console.warn('Could not remove temp audio file:', cleanupErr);
      }
    }
  } catch (error: any) {
    console.error('[Audio Transcription Error]', error);
    return res.status(500).json({
      error: 'Failed to transcribe audio recording via Groq Whisper',
      details: error.message,
    });
  }
}
