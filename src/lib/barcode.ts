"use client";

interface Detector {
  detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: { new (o?: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };
  }
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];

export async function makeDetector(): Promise<Detector | null> {
  if (typeof window === "undefined" || !window.BarcodeDetector) return null;
  try {
    return new window.BarcodeDetector({ formats: FORMATS });
  } catch {
    return null;
  }
}

/** Reads a barcode from a still photo: BarcodeDetector if present, else ZXing. */
export async function readBarcodeFromFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const det = await makeDetector();
    if (det) {
      const bmp = await createImageBitmap(file);
      const res = await det.detect(bmp);
      if (res[0]?.rawValue) return res[0].rawValue;
    }
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const r = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
    return r.getText();
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
