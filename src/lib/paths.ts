// Use for browser URLs and API payloads. Next Link, router and redirect add this themselves.
export function withBasePath(path: string) {
  return (process.env.NEXT_PUBLIC_BASE_PATH || '') + path;
}

// Browser pathnames already include the prefix; Next router expects an app-relative path.
export function withoutBasePath(pathname: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return basePath && (pathname === basePath || pathname.startsWith(basePath + '/')) ? pathname.slice(basePath.length) || '/' : pathname;
}
