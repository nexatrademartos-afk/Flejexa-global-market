import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_IMAGE_BYTES,
  TARGET_IMAGE_BYTES,
  compressProductImage,
} from "@/lib/product-image";

function mockImageProcessing(outputBytes: number) {
  const drawImage = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage })),
    toBlob: vi.fn((callback: BlobCallback) => {
      callback(new Blob([new Uint8Array(outputBytes)], { type: "image/webp" }));
    }),
  };

  const close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 2400, height: 1600, close })),
  );
  vi.stubGlobal("document", {
    createElement: vi.fn(() => canvas),
  });

  return { canvas, close };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("compressProductImage", () => {
  it("returns a WebP image at or below the preferred 90 KB target", async () => {
    const { canvas, close } = mockImageProcessing(TARGET_IMAGE_BYTES - 1);
    const result = await compressProductImage(
      new File(["image"], "product.jpg", { type: "image/jpeg" }),
    );

    expect(result.type).toBe("image/webp");
    expect(result.size).toBeLessThanOrEqual(TARGET_IMAGE_BYTES);
    expect(canvas.width).toBe(1200);
    expect(close).toHaveBeenCalledOnce();
  });

  it("accepts the best compressed image when it is above 90 KB but below 150 KB", async () => {
    const { close } = mockImageProcessing(MAX_IMAGE_BYTES - 1);
    const result = await compressProductImage(
      new File(["image"], "product.png", { type: "image/png" }),
    );

    expect(result.size).toBe(MAX_IMAGE_BYTES - 1);
    expect(close).toHaveBeenCalledOnce();
  });

  it("rejects an image that remains above the strict 150 KB maximum", async () => {
    const { close } = mockImageProcessing(MAX_IMAGE_BYTES + 1);

    await expect(
      compressProductImage(
        new File(["image"], "product.jpg", { type: "image/jpeg" }),
      ),
    ).rejects.toThrow("larger than 150 KB");

    expect(close).toHaveBeenCalledOnce();
  });

  it("rejects files that are not images", async () => {
    await expect(
      compressProductImage(
        new File(["text"], "notes.txt", { type: "text/plain" }),
      ),
    ).rejects.toThrow("Please choose an image file.");
  });
});
