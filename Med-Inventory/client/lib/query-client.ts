import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Gets the base URL or full URL for the Express API server (e.g., "http://localhost:5000" or "https://domain.com")
 * Supports localhost HTTP while retaining production HTTPS.
 * @param {string} [path] Optional path to append (e.g., "/api/upload/extract")
 * @returns {string} The resolved API URL
 */
export function getApiUrl(path?: string): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN || "localhost:5000";

  let base: string;
  if (/^https?:\/\//i.test(host)) {
    base = host;
  } else {
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.includes(":5000");
    const protocol = isLocal ? "http://" : "https://";
    base = `${protocol}${host}`;
  }

  if (!base.endsWith("/")) {
    base += "/";
  }

  if (path) {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return new URL(cleanPath, base).href;
  }

  return base;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
