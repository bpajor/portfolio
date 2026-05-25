import { describe, expect, it } from "vitest";
import { cleanAltText, formatMediaSize, validateMediaUpload } from "./media-model";

describe("admin media model", () => {
  it("requires an image file and alt text", () => {
    expect(validateMediaUpload(undefined, "Hero image")).toBe("Choose an image before uploading.");
    expect(validateMediaUpload(new File(["plain"], "note.txt", { type: "text/plain" }), "Hero image")).toBe("Only image files can be uploaded.");
    expect(validateMediaUpload(new File(["image"], "hero.png", { type: "image/png" }), " ")).toBe("Alt text is required for uploaded images.");
  });

  it("accepts image uploads with cleaned alt text", () => {
    const file = new File(["image"], "hero.png", { type: "image/png" });

    expect(cleanAltText(" Portfolio hero ")).toBe("Portfolio hero");
    expect(validateMediaUpload(file, " Portfolio hero ")).toBe("");
  });

  it("formats media sizes for compact admin display", () => {
    expect(formatMediaSize(0)).toBe("0 B");
    expect(formatMediaSize(512)).toBe("512 B");
    expect(formatMediaSize(1536)).toBe("1.5 KB");
    expect(formatMediaSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
