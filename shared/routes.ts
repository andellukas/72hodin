import { z } from "zod";
import { commandHistory } from "./schema";

export const api = {
  shell: {
    execute: {
      method: "POST" as const,
      path: "/api/shell/execute",
      input: z.object({ command: z.string().min(1) }),
      responses: {
        200: z.object({ 
          output: z.string(), 
          status: z.enum(["success", "error"]) 
        }),
        500: z.object({ message: z.string() })
      }
    },
    history: {
      method: "GET" as const,
      path: "/api/shell/history",
      responses: {
        200: z.array(z.custom<typeof commandHistory.$inferSelect>()),
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
