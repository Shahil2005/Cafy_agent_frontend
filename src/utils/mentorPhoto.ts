/** Supabase storage transform — smaller files for cards/avatars (falls back to original URL on error). */
export function mentorPhotoUrl(url: string, pixelWidth: number): string {
  if (!url?.trim()) return '';

  const trimmed = url.trim();
  if (!trimmed.includes('.supabase.co/storage/v1/object/public/')) {
    return trimmed;
  }

  const render = trimmed.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );
  const height = Math.round(pixelWidth * 1.4);
  return `${render}?width=${pixelWidth}&height=${height}&resize=cover&quality=80`;
}

export function preloadMentorPhotos(
  mentors: { photoUrl: string }[],
  count = 8,
  pixelWidth = 520
): void {
  mentors.slice(0, count).forEach((mentor) => {
    const src = mentorPhotoUrl(mentor.photoUrl, pixelWidth);
    if (!src) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  });
}
