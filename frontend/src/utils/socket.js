export function getSocketUrl() {
  const socketUrl = import.meta.env.VITE_SOCKET_URL;
  if (socketUrl) return socketUrl;

  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl || apiUrl.startsWith('/')) {
    return window.location.origin;
  }

  try {
    const url = new URL(apiUrl, window.location.origin);
    if (url.pathname.endsWith('/api')) {
      url.pathname = url.pathname.slice(0, -4);
    }
    const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
    return `${url.origin}${pathname}`;
  } catch {
    return window.location.origin;
  }
}