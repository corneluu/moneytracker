import { createWorker } from 'tesseract.js';

/**
 * Resize & compress receipt file to fit strictly under Google Sheets 35,000 character cell limit
 */
export async function compressReceiptFile(file) {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = () => {
        const fullDataUrl = reader.result;
        resolve({
          type: 'pdf',
          name: file.name,
          dataUrl: fullDataUrl,
          previewUrl: null,
          // PDFs store compact reference in Google Sheets cell & full data in LocalStorage
          sheetPayload: `PDF_LOCAL:${file.name}`,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let maxDim = 450;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        let canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let compressedBase64 = canvas.toDataURL('image/jpeg', 0.4);

        // If still > 35,000 characters, downscale further
        if (compressedBase64.length > 35000) {
          maxDim = 320;
          width = img.width > img.height ? maxDim : (img.width * maxDim) / img.height;
          height = img.height > img.width ? maxDim : (img.height * maxDim) / img.width;
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          compressedBase64 = canvas.toDataURL('image/jpeg', 0.25);
        }

        const fitsInSheet = compressedBase64.length <= 35000;

        resolve({
          type: 'image',
          name: file.name,
          dataUrl: compressedBase64,
          previewUrl: compressedBase64,
          sheetPayload: fitsInSheet ? compressedBase64 : `IMG_LOCAL:${file.name}`,
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

    let detectedPrice = null;

    const pricePatterns = [
      /(?:total|suma|de\s*platit|rest|card|numerar|cash)\s*[:=]?\s*(\d+[.,]\d{2})/i,
      /(\d+[.,]\d{2})\s*(?:lei|ron)/i,
      /(\d+[.,]\d{2})/
    ];

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

    let detectedItem = '';
    if (lines.length > 0) {
      const candidate = lines.find(l => /[a-zA-Z]{3,}/.test(l) && !/bon\s*fiscal/i.test(l));
      if (candidate) {
        detectedItem = candidate.slice(0, 30);
      }
    }

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
