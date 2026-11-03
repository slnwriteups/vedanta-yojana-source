/** Direct content links open immediately, regardless of referrer or user agent. */
export function isHomeEntry(pathname: string, basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""): boolean {
  const clean = (value: string) => value.replace(/\/+$/, "");
  return clean(pathname) === clean(basePath);
}
