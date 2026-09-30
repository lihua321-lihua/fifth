// 前端图片压缩：最大边 1024px，JPEG 质量 0.7，控制 Base64 体积（SPEC 5.2 / 第 17 节）
export type CompressedImage = {
  dataUrl: string; // "data:image/jpeg;base64,..."
  base64: string; // 纯 base64，不含前缀
  mime: string; // "image/jpeg"
};

const MAX_EDGE = 1024;
const QUALITY = 0.7;

export async function compressImage(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let targetWidth = width;
  let targetHeight = height;
  if (width > height && width > MAX_EDGE) {
    targetWidth = MAX_EDGE;
    targetHeight = Math.round((height / width) * MAX_EDGE);
  } else if (height >= width && height > MAX_EDGE) {
    targetHeight = MAX_EDGE;
    targetWidth = Math.round((width / height) * MAX_EDGE);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建画布");
  }
  // 白底，避免透明 PNG 转 JPEG 后变黑
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  bitmap.close();

  return {
    dataUrl,
    base64: dataUrl.split(",")[1],
    mime: "image/jpeg",
  };
}