import { createWorker } from 'tesseract.js';

/**
 * Resize & compress receipt image to fit in Google Sheets cell (~25KB max base64)
 */
export async function compressReceiptFile(file) {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      // Handle PDF digital receipts
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          type: 'pdf',
          name: file.name,
          dataUrl: reader.result,
          previewUrl: null, // PDF badge indicator
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    // Handle Image receipts (Camera or Gallery)
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 700;
        const MAX_HEIGHT = 700;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Quality 0.55 ensures ~15-25KB base64 size
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.55);
        resolve({
          type: 'image',
          name: file.name,
          dataUrl: compressedBase64,
          previewUrl: compressedBase64,
        });
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Run OCR scan on receipt image to extract price, date, merchant name
 */
export async function parseReceiptOCR(dataUrl) {
  try {
    const worker = await createWorker('ron+eng');
    const ret = await worker.recognize(dataUrl);
    await worker.terminate();

    const text = ret.data.text || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. Detect Total Amount (e.g. TOTAL 125.50 or 125,50 LEI / RON / SUMA)
    let detectedPrice = null;

    // Look for lines containing TOTAL, SUMA, PAY, DE PLATIT, LEI, RON
    const pricePatterns = [
      /(?:total|suma|de\s*platit|rest|card|numerar|cash)\s*[:=]?\s*(\d+[.,]\d{2})/i,
      /(\d+[.,]\d{2})\s*(?:lei|ron)/i,
      /(\d+[.,]\d{2})/
    ];

    // Search lines from bottom to top for TOTAL line
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (/total|suma|de\s*platit/i.test(line)) {
        const match = line.match(/(\d+[.,]\d{2})/);
        if (match) {
          detectedPrice = parseFloat(match[1].replace(',', '.'));
          break;
        }
      }
    }

    // Fallback: look for LEI/RON or general decimals if no explicit TOTAL keyword line matched
    if (!detectedPrice) {
      for (const line of lines) {
        for (const pattern of pricePatterns) {
          const match = line.match(pattern);
          if (match) {
            const val = parseFloat(match[1].replace(',', '.'));
            if (!isNaN(val) && val > 0 && val < 50000) {
              detectedPrice = val;
              break;
            }
          }
        }
        if (detectedPrice) break;
      }
    }

    // 2. Detect Merchant / Item Name (usually top line)
    let detectedItem = '';
    if (lines.length > 0) {
      // Pick first line with letters that isn't just numbers/symbols
      const candidate = lines.find(l => /[a-zA-Z]{3,}/.test(l) && !/bon\s*fiscal/i.test(l));
      if (candidate) {
        detectedItem = candidate.slice(0, 30);
      }
    }

    // 3. Detect Date (DD.MM.YYYY or DD/MM/YYYY)
    let detectedDate = null;
    const dateMatch = text.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
    if (dateMatch) {
      const [_, day, month, year] = dateMatch;
      detectedDate = `${year}-${month}-${day}`;
    }

    return {
      detectedPrice,
      detectedDate,
      detectedItem,
      fullText: text,
    };
  } catch (err) {
    console.warn('OCR processing failed:', err);
    return { detectedPrice: null, detectedDate: null, detectedItem: '', fullText: '' };
  }
}
