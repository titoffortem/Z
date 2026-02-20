import { NextResponse } from 'next/server';

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

const FREEIMAGE_API_KEY = process.env.FREEIMAGE_API_KEY || process.env.NEXT_PUBLIC_FREEIMAGE_API_KEY || '6d207e02198a847aa98d0a2a901485a5';
const RESMUSH_QUALITY = 92;
const RESMUSH_URL = `https://api.resmush.it/ws.php?qlty=${RESMUSH_QUALITY}`;

async function compressImage(file: File): Promise<Blob> {
  const compressFormData = new FormData();
  compressFormData.append('files', file, file.name);

  try {
    const compressResponse = await fetch(RESMUSH_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'Z/1.0',
        Referer: 'https://z.example',
      },
      body: compressFormData,
    });

    if (!compressResponse.ok) {
      return file;
    }

    const compressData = (await compressResponse.json()) as ResmushResponse;
    if (compressData.error || !compressData.dest) {
      return file;
    }

    const optimizedResponse = await fetch(compressData.dest);
    if (!optimizedResponse.ok) {
      return file;
    }

    return await optimizedResponse.blob();
  } catch {
    return file;
  }
}

export async function POST(request: Request) {
  try {
    if (!FREEIMAGE_API_KEY) {
      return NextResponse.json({ error: 'Freeimage API key is not configured.' }, { status: 500 });
    }

    const inputFormData = await request.formData();
    const file = inputFormData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required.' }, { status: 400 });
    }

    const compressedBlob = await compressImage(file);
    const compressedFile = new File([compressedBlob], file.name, {
      type: compressedBlob.type || file.type || 'application/octet-stream',
    });

    const uploadFormData = new FormData();
    uploadFormData.append('key', FREEIMAGE_API_KEY);
    uploadFormData.append('action', 'upload');
    uploadFormData.append('format', 'json');
    uploadFormData.append('source', compressedFile, compressedFile.name);

    const uploadResponse = await fetch('https://freeimage.host/api/1/upload', {
      method: 'POST',
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      return NextResponse.json({ error: 'Freeimage upload failed.' }, { status: 502 });
    }

    const uploadData = (await uploadResponse.json()) as FreeimageUploadResponse;
    const imageUrl = uploadData?.image?.url || uploadData?.image?.display_url;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Freeimage response did not include image URL.' }, { status: 502 });
    }

    return NextResponse.json({ url: imageUrl }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Unexpected upload error.' }, { status: 500 });
  }
}
