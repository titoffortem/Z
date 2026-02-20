const FREEIMAGE_API_KEY = process.env.NEXT_PUBLIC_FREEIMAGE_API_KEY || '6d207e02198a847aa98d0a2a901485a5';
const RESMUSH_QUALITY = 92;

type ResmushResponse = {
  dest?: string;
  error?: number;
  error_log?: string;
};

type FreeimageUploadResponse = {
  status_code?: number;
  image?: {
    url?: string;
    display_url?: string;
  };
};

async function compressImageWithResmush(file: File): Promise<File> {
  const formData = new FormData();
  formData.append('files', file, file.name);

  try {
    const response = await fetch(`https://api.resmush.it/ws.php?qlty=${RESMUSH_QUALITY}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return file;
    }

    const data = (await response.json()) as ResmushResponse;
    if (data.error || !data.dest) {
      return file;
    }

    const optimizedImageResponse = await fetch(data.dest);
    if (!optimizedImageResponse.ok) {
      return file;
    }

    const optimizedBlob = await optimizedImageResponse.blob();
    return new File([optimizedBlob], file.name, { type: optimizedBlob.type || file.type });
  } catch {
    return file;
  }
}

export async function uploadImageWithCompression(file: File): Promise<string | null> {
  if (!FREEIMAGE_API_KEY) {
    return null;
  }

  const compressedFile = await compressImageWithResmush(file);
  const formData = new FormData();
  formData.append('key', FREEIMAGE_API_KEY);
  formData.append('action', 'upload');
  formData.append('format', 'json');
  formData.append('source', compressedFile, compressedFile.name);

  try {
    const response = await fetch('https://freeimage.host/api/1/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as FreeimageUploadResponse;
    return data?.image?.url || data?.image?.display_url || null;
  } catch {
    return null;
  }
}
