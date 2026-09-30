import type { VercelRequest, VercelResponse } from '@vercel/node';
import documentHandler from './document.js';

/**
 * Backward compatibility handler for /api/extract/pdf.
 * Seamlessly delegates all extraction requests to the unified multi-format document engine.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return documentHandler(req, res);
}
