export function createSafeUrl(text: string, maxLength: number = 120): string {
  // First do basic slugification
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '-') // Convert spaces, underscores and multiple hyphens to single hyphens
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars except hyphens
    .replace(/\-\-+/g, '-')   // Replace multiple hyphens with single hyphen
    .replace(/^-+/, '')       // Trim hyphens from start
    .replace(/-+$/, '');      // Trim hyphens from end

  // If the slug is already short enough, return it
  if (slug.length <= maxLength) {
    return slug;
  }

  // Otherwise, truncate at word boundary and ensure we don't end with a hyphen
  const truncated = slug.substring(0, maxLength).replace(/-[^-]*$/, '');
  return truncated.replace(/-+$/, '');
}
