// Reads a dropped file for the AI features (AI Notes, AI Slides), in the browser.
// PDFs are sent as they are (Gemini reads them); slides, Word and text files are turned
// into plain text here, so only the text leaves the device.

import { MAX_PDF_BYTES, pptxToText } from './notes';

export function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** What we send to the server for a file: the PDF itself, or the text we pulled out. */
export async function readFile(file: File): Promise<{ text?: string; pdfBase64?: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    if (file.size > MAX_PDF_BYTES) throw new Error('PDFs up to 3 MB for now. Try a smaller one.');
    return { pdfBase64: await toBase64(file) };
  }
  if (name.endsWith('.pptx')) return { text: await pptxToText(file) };
  if (name.endsWith('.docx')) {
    const { docxToMarkdown } = await import('../../notes/logic/convert');
    return { text: await docxToMarkdown(file) };
  }
  if (name.endsWith('.txt') || name.endsWith('.md')) return { text: await file.text() };
  throw new Error('Use a .pdf, .pptx, .docx, .txt or .md file.');
}
