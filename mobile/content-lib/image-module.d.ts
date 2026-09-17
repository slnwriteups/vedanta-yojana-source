/**
 * Ambient declarations for every binary asset extension this project
 * actually bundles via a static `import` -- .jpg/.png/.webp under
 * public/images/, .mp3 under public/audio/, and .pdf under
 * mobile/assets/pasurams/ (no .jpeg or .gif exist). Metro's default
 * asset transformer resolves such an import to a numeric asset id at
 * bundle time; tsc has no way to know that without this declaration,
 * mirroring json-module.d.ts's role for JSON.
 */
declare module "*.jpg" {
  const value: number;
  export default value;
}
declare module "*.png" {
  const value: number;
  export default value;
}
declare module "*.webp" {
  const value: number;
  export default value;
}
/**
 * The one audio file under public/audio/ (the restored welcome screen's
 * ambient track, see components/WelcomeScreen.tsx) -- same Metro
 * numeric-asset-id resolution as the image extensions above.
 */
declare module "*.mp3" {
  const value: number;
  export default value;
}
/**
 * The bundled Pasuram PDFs under mobile/assets/pasurams/ (see
 * pasuramOfflineService.ts and scripts/generate-pasuram-manifest.ts) --
 * same Metro numeric-asset-id resolution as the extensions above.
 */
declare module "*.pdf" {
  const value: number;
  export default value;
}
