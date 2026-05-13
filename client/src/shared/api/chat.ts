import { apiClient } from "./client";
import { streamChat, type SSEStreamOptions } from "./sse";
import type {
  CreateSessionResponse,
  SessionListResponse,
  SessionDetail,
  SendMessageRequest,
  Recommendation,
  ApiResponse,
} from "@/shared/types/chat";

export async function createSession() {
  const res =
    await apiClient.post<ApiResponse<CreateSessionResponse>>("/chat/sessions");
  return res.data.data;
}

export async function getSessions(page = 1, pageSize = 20) {
  const res = await apiClient.get<ApiResponse<SessionListResponse>>(
    "/chat/sessions",
    {
      params: { page, pageSize },
    },
  );
  return res.data.data;
}

export async function getSession(id: string) {
  const res = await apiClient.get<ApiResponse<SessionDetail>>(
    `/chat/sessions/${id}`,
  );
  return res.data.data;
}

export async function deleteSession(id: string) {
  const res = await apiClient.delete<ApiResponse<null>>(`/chat/sessions/${id}`);
  return res.data.data;
}

export function sendMessage(
  data: SendMessageRequest,
  options: SSEStreamOptions,
) {
  return streamChat("/api/chat/messages", data, options);
}

export function generateSummary(sessionId: string, options: SSEStreamOptions) {
  return streamChat(`/api/chat/sessions/${sessionId}/summary`, {}, options);
}

export async function getRecommendations() {
  const res = await apiClient.get<
    ApiResponse<{ recommendations: Recommendation[] }>
  >("/chat/recommendations");
  return res.data.data.recommendations;
}
