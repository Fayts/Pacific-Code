// URLs publiques des fichiers stockés dans Supabase Storage.
// Les buckets logos et equipment-images sont publics en lecture ;
// l'écriture est restreinte par organisation (politiques RLS storage).

function publicStorageUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export function equipmentImageUrl(storagePath: string): string {
  return publicStorageUrl("equipment-images", storagePath);
}

export function logoUrl(storagePath: string): string {
  return publicStorageUrl("logos", storagePath);
}
