import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

// GET /api/shell/history
export function useCommandHistory() {
  return useQuery({
    queryKey: [api.shell.history.path],
    queryFn: async () => {
      const res = await fetch(api.shell.history.path);
      if (!res.ok) throw new Error("Failed to fetch history");
      return api.shell.history.responses[200].parse(await res.json());
    },
  });
}

// POST /api/shell/execute
export function useExecuteCommand() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (command: string) => {
      const payload = { command };
      const validated = api.shell.execute.input.parse(payload);
      
      const res = await fetch(api.shell.execute.path, {
        method: api.shell.execute.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        if (res.status === 500) {
          const error = api.shell.execute.responses[500].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to execute command");
      }
      
      return api.shell.execute.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.shell.history.path] });
    },
  });
}
