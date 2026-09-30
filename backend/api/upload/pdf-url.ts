import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from '../_utils/auth.js';
import { getSupabaseAdmin } from '../_utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Verify Firebase authentication token
  const authUser = await verifyAuth(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in to upload files.' });
  }

  try {
    const { fileName } = req.body || {};
    const rawName = typeof fileName === 'string' && fileName.trim() ? fileName.trim() : 'document.pdf';

    // Validate supported document extensions (pdf, docx, pptx, xlsx, csv)
    const supportedExtRegex = /\.(pdf|docx|pptx|xlsx|csv)$/i;
    let finalFileName = rawName;
    if (!supportedExtRegex.test(finalFileName)) {
      finalFileName = `${finalFileName}.pdf`;
    }

    // Sanitize file name to avoid path traversal and illegal characters
    const sanitizedFileName = finalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const relativePath = `${authUser.uid}/${timestamp}_${sanitizedFileName}`;
    const storagePath = `pdfs/${relativePath}`;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from('pdfs')
      .createSignedUploadUrl(relativePath);

    if (error || !data) {
      console.error('[Supabase Storage Signed URL Error]:', error);
      return res.status(500).json({
        error: 'Failed to create signed upload URL',
        details: error?.message,
      });
    }

    return res.status(200).json({
      signedUrl: data.signedUrl,
      storagePath,
      relativePath,
      token: data.token,
    });
  } catch (error: any) {
    console.error('[PDF Signed URL Generation Error]:', error);
    return res.status(500).json({
      error: 'Failed to initialize PDF upload',
      details: error?.message,
    });
  }
}
