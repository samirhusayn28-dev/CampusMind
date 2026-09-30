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
    return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
  }

  try {
    const { paths } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'Missing or empty paths array in request body' });
    }

    const expectedUserPrefix = `${authUser.uid}/`;
    const relativePathsToDelete: string[] = [];

    for (const rawPath of paths) {
      if (typeof rawPath !== 'string') continue;
      const cleanPath = rawPath.trim();
      if (!cleanPath || cleanPath.includes('..') || cleanPath.includes('\\')) {
        continue;
      }

      // Strip optional bucket prefix 'pdfs/'
      const rel = cleanPath.startsWith('pdfs/') ? cleanPath.slice('pdfs/'.length) : cleanPath;

      // Strict user security ownership check
      if (rel.startsWith(expectedUserPrefix)) {
        relativePathsToDelete.push(rel);
      }
    }

    if (relativePathsToDelete.length === 0) {
      return res.status(200).json({ success: true, deletedCount: 0 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from('pdfs')
      .remove(relativePathsToDelete);

    if (error) {
      console.error('[Supabase Storage Deletion Error]:', error);
      return res.status(500).json({
        error: 'Failed to delete files from storage',
        details: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      deletedCount: data?.length ?? relativePathsToDelete.length,
      deleted: data,
    });
  } catch (error: any) {
    console.error('[Storage Delete Handler Error]:', error);
    return res.status(500).json({
      error: 'Unexpected error during file deletion',
      details: error.message,
    });
  }
}
