import axios, { AxiosError, AxiosInstance } from "axios";
import { API_BASE_URL } from "@/lib/constants";
import { firebaseAuth } from "@/lib/firebase";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  // Content/PPT/audio/video generation are long-running calls.
  timeout: 15 * 60 * 1000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const user = firebaseAuth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Normalizes any transport/API failure into an Error with a human message. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const apiMessage = (error.response?.data as { message?: string } | undefined)?.message;
    if (apiMessage) return apiMessage;
    if (error.code === "ECONNABORTED") return "The request timed out. Please try again.";
    if (!error.response) return "Cannot reach the SMART AI server. Is the backend running?";
  }
  return error instanceof Error ? error.message : "Something went wrong";
}

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get<ApiEnvelope<T>>(url, { params });
  return data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post<ApiEnvelope<T>>(url, body);
  return data.data;
}

/**
 * Posts a FormData body (file upload). The instance default `Content-Type:
 * application/json` header must be cleared for this call — otherwise axios
 * sees a JSON content-type already set and serializes the FormData as JSON
 * instead of leaving it for the browser to encode as multipart with a boundary.
 */
export async function apiPostForm<T>(url: string, formData: FormData): Promise<T> {
  const { data } = await api.post<ApiEnvelope<T>>(url, formData, {
    headers: { "Content-Type": undefined },
  });
  return data.data;
}

/** Streams an authenticated download and hands it to the browser. */
export async function apiDownload(url: string, fallbackName: string): Promise<void> {
  const response = await api.get<Blob>(url, { responseType: "blob" });

  const disposition = response.headers["content-disposition"] as string | undefined;
  const match = disposition?.match(/filename="?([^";]+)"?/);
  const filename = match?.[1] ?? fallbackName;

  const blobUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}
