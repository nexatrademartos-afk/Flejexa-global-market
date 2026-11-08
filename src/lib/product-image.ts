export const MAX_ORIGINAL_IMAGE_BYTES = 20 * 1024 * 1024;
export const TARGET_IMAGE_BYTES = 90 * 1024;
export const MAX_IMAGE_BYTES = 150 * 1024;
export const MAX_IMAGE_DIMENSION = 1200;

const IMAGE_QUALITIES = [0.88, 0.8, 0.72, 0.64, 0.56, 0.48];

export async function compressProductImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
    throw new Error("Each original image must be 20 MB or smaller.");
  }

  const bitmap = await createImageBitmap(file);

  try {
    const initialScale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    let width = Math.max(1, Math.round(bitmap.width * initialScale));
    let height = Math.max(1, Math.round(bitmap.height * initialScale));
    let bestBlob: Blob | null = null;

    for (let resizeAttempt = 0; resizeAttempt < 7; resizeAttempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Your browser could not process this image.");
      }

      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of IMAGE_QUALITIES) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (result) => {
              if (result) resolve(result);
              else reject(new Error("Image compression failed.")); 
            },
            "image/webp",
            quality,
          );
        });

        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
        }

        if (blob.size <= TARGET_IMAGE_BYTES) {
          return blob;
        }
      }

      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
    }

    if (bestBlob && bestBlob.size <= MAX_IMAGE_BYTES) {
      return bestBlob;
    }

    throw new Error(
      "This image is still larger than 150 KB after compression. Please choose a smaller image.",
    );
  } finally {
    bitmap.close();
  }
}
