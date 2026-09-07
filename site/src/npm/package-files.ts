export function isPackageCompilerFile(filename: string): boolean {
  return /\.(?:json|[cm]?ts|tsx|d\.[cm]?ts\.map)$/.test(filename);
}
