export interface ApiError extends Error {
  status: number;
  details?: unknown;
}

/** Shared browser fetch helper: bounces to /login on 401 and unwraps errorResponse bodies. */
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (response.status === 401) {
    window.location.assign('/login');
    throw new Error('Sessão expirada.');
  }
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(
      data.details ? `${data.error}\n${JSON.stringify(data.details, null, 2)}` : data.error,
    ) as ApiError;
    error.status = response.status;
    error.details = data.details;
    throw error;
  }
  return data;
}
