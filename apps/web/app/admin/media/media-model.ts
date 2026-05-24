export type AdminMediaItem = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  altText: string;
  url: string;
  createdAt: string;
};

export function cleanAltText(value: FormDataEntryValue | string | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateMediaUpload(file: File | null | undefined, altText: string) {
  if (!file || file.size === 0) {
    return "Choose an image before uploading.";
  }
  if (!file.type.startsWith("image/")) {
    return "Only image files can be uploaded.";
  }
  if (cleanAltText(altText) === "") {
    return "Alt text is required for uploaded images.";
  }
  return "";
}

export function formatMediaSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "0 B";
  }
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}
