export async function uploadImageWithCompression(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  try {
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { url?: string };
    return data?.url ?? null;
  } catch {
    return null;
  }
}
