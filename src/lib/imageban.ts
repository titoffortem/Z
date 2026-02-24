import { firebaseConfig } from '@/firebase/config';

const IMAGEBAN_API_URL = 'https://api.imageban.ru/v1';

type ImageBanResponse = {
  success?: boolean;
  data?:
    | Array<{ link?: string }>
    | { link?: string };
  error?: {
    code?: string;
    message?: string;
  };
};

export async function uploadToImageBan(file: File): Promise<string | null> {
  const clientId = firebaseConfig.imagebanClientId;
  if (!clientId) {
    console.error('ImageBan CLIENT_ID is not configured in firebase/config.ts');
    return null;
  }

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(IMAGEBAN_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `TOKEN ${clientId}`,
      },
      body: formData,
    });

    const responseText = await response.text();
    let payload: ImageBanResponse = {};

    if (responseText) {
      try {
        payload = JSON.parse(responseText) as ImageBanResponse;
      } catch {
        // Оставим payload пустым и покажем сырой ответ ниже
      }
    }

    if (!response.ok) {
      console.error('ImageBan upload failed:', {
        status: response.status,
        payload,
        responseText,
      });
      return null;
    }

    const dataNode = payload.data;
    const link = Array.isArray(dataNode)
      ? dataNode[0]?.link
      : dataNode?.link;

    if (typeof link === 'string' && link.length > 0) {
      return link;
    }

    console.error('ImageBan API returned unexpected payload:', {
      payload,
      responseText,
    });
    return null;
  } catch (error) {
    console.error('Error during ImageBan upload:', error);
    return null;
  }
}
