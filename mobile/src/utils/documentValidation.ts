import * as FileSystem from 'expo-file-system';

export type SupportedDocumentFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'csv';

export interface SupportedFormatDefinition {
  format: SupportedDocumentFormat;
  label: string;
  extensions: string[];
  mimeTypes: string[];
  defaultMime: string;
}

export const SUPPORTED_DOCUMENT_FORMATS: SupportedFormatDefinition[] = [
  {
    format: 'pdf',
    label: 'PDF Document (.pdf)',
    extensions: ['pdf'],
    mimeTypes: ['application/pdf'],
    defaultMime: 'application/pdf',
  },
  {
    format: 'docx',
    label: 'Word Document (.docx)',
    extensions: ['docx', 'doc'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
    defaultMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  {
    format: 'pptx',
    label: 'PowerPoint Presentation (.pptx)',
    extensions: ['pptx', 'ppt'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
    ],
    defaultMime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
  {
    format: 'xlsx',
    label: 'Excel Spreadsheet (.xlsx)',
    extensions: ['xlsx', 'xls'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
    defaultMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    format: 'csv',
    label: 'CSV Data (.csv)',
    extensions: ['csv'],
    mimeTypes: [
      'text/csv',
      'application/csv',
      'text/comma-separated-values',
      'application/vnd.ms-excel', // Android sometimes maps CSV to Excel MIME
    ],
    defaultMime: 'text/csv',
  },
];

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'apk', 'bin', 'js', 'vbs', 'scr', 'msi', 'com', 'pif'
]);

export interface DetectedDocumentInfo {
  format: SupportedDocumentFormat;
  normalizedFileName: string;
  mimeType: string;
  isPdf: boolean;
  isDocx: boolean;
  isPptx: boolean;
  isXlsx: boolean;
  isCsv: boolean;
}

/**
 * Extracts a file extension from a file name or URI string, ignoring query params or hash fragments.
 */
function extractExtension(pathOrName: string): string | null {
  if (!pathOrName) return null;
  const clean = pathOrName.split('?')[0].split('#')[0].trim();
  const lastDot = clean.lastIndexOf('.');
  if (lastDot === -1 || lastDot === clean.length - 1) return null;
  const ext = clean.substring(lastDot + 1).toLowerCase();
  // Valid alphanumeric extensions between 2 and 6 characters
  return /^[a-z0-9]{2,6}$/.test(ext) ? ext : null;
}

/**
 * Inspects the file name, URI, MIME type, and binary header/magic bytes to accurately
 * and safely detect the document format on both Android and iOS devices.
 */
export async function detectDocumentFormat(file: {
  name?: string;
  uri: string;
  mimeType?: string;
  size?: number;
}): Promise<DetectedDocumentInfo | null> {
  const rawName = (file.name || '').trim();
  const decodedUri = decodeURIComponent(file.uri || '');
  const rawMime = (file.mimeType || '').trim().toLowerCase();

  // 1. Check for blocked/dangerous executable extensions
  const nameExt = extractExtension(rawName);
  const uriExt = extractExtension(decodedUri);
  if ((nameExt && DANGEROUS_EXTENSIONS.has(nameExt)) || (uriExt && DANGEROUS_EXTENSIONS.has(uriExt))) {
    return null;
  }

  let matchedFormat: SupportedDocumentFormat | null = null;
  let detectedExt: string = nameExt || uriExt || '';

  // 2. Extension matching from file name or URI
  if (nameExt || uriExt) {
    const extToCheck = nameExt || uriExt;
    if (extToCheck === 'pdf') matchedFormat = 'pdf';
    else if (extToCheck === 'docx' || extToCheck === 'doc') matchedFormat = 'docx';
    else if (extToCheck === 'pptx' || extToCheck === 'ppt') matchedFormat = 'pptx';
    else if (extToCheck === 'xlsx' || extToCheck === 'xls') matchedFormat = 'xlsx';
    else if (extToCheck === 'csv') matchedFormat = 'csv';
  }

  // 3. MIME type inspection if extension was missing or ambiguous
  if (!matchedFormat && rawMime && rawMime !== 'application/octet-stream' && rawMime !== '*/*') {
    for (const def of SUPPORTED_DOCUMENT_FORMATS) {
      if (def.mimeTypes.some((m) => m.toLowerCase() === rawMime)) {
        matchedFormat = def.format;
        detectedExt = def.extensions[0];
        break;
      }
    }
  }

  // 4. Magic bytes inspection via base64 header read (useful when Android returns generic content URI or application/octet-stream)
  if (!matchedFormat && file.uri) {
    try {
      const headerB64 = await FileSystem.readAsStringAsync(file.uri, {
        length: 1024,
        encoding: FileSystem.EncodingType.Base64,
      });

      if (headerB64) {
        const binaryHeader = atob(headerB64.slice(0, 512));

        // PDF check (%PDF-)
        if (binaryHeader.includes('%PDF-')) {
          matchedFormat = 'pdf';
          detectedExt = 'pdf';
        }
        // ZIP container check (PK\x03\x04 = 0x50 0x4B 0x03 0x04) for DOCX, PPTX, XLSX
        else if (binaryHeader.charCodeAt(0) === 0x50 && binaryHeader.charCodeAt(1) === 0x4B) {
          // If the name/URI has any hint, prioritize it, otherwise default to docx
          if (rawName.toLowerCase().includes('pres') || rawName.toLowerCase().includes('slide')) {
            matchedFormat = 'pptx';
            detectedExt = 'pptx';
          } else if (rawName.toLowerCase().includes('sheet') || rawName.toLowerCase().includes('calc')) {
            matchedFormat = 'xlsx';
            detectedExt = 'xlsx';
          } else {
            matchedFormat = 'docx';
            detectedExt = 'docx';
          }
        }
        // CSV check: readable plain text with delimiters and newlines
        else if (!binaryHeader.includes('\0')) {
          const lines = binaryHeader.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length >= 1 && (binaryHeader.includes(',') || binaryHeader.includes(';') || binaryHeader.includes('\t'))) {
            matchedFormat = 'csv';
            detectedExt = 'csv';
          }
        }
      }
    } catch (err) {
      console.warn('[detectDocumentFormat] Magic bytes inspection failed:', err);
    }
  }

  if (!matchedFormat) {
    return null;
  }

  // Find format definition for standard MIME
  const def = SUPPORTED_DOCUMENT_FORMATS.find((d) => d.format === matchedFormat)!;
  const mimeType = def.defaultMime;

  // Build clean, normalized file name ensuring the correct extension
  let baseName = rawName || `Document_${Date.now()}`;
  // Remove existing extension if any
  baseName = baseName.replace(/\.(pdf|docx|doc|pptx|ppt|xlsx|xls|csv)$/i, '');
  // Sanitize illegal characters
  baseName = baseName.replace(/[^a-zA-Z0-9 _-]/g, '_').trim() || 'Document';
  const normalizedFileName = `${baseName}.${matchedFormat}`;

  return {
    format: matchedFormat,
    normalizedFileName,
    mimeType,
    isPdf: matchedFormat === 'pdf',
    isDocx: matchedFormat === 'docx',
    isPptx: matchedFormat === 'pptx',
    isXlsx: matchedFormat === 'xlsx',
    isCsv: matchedFormat === 'csv',
  };
}
