import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // POST /api/shell/execute
  app.post(api.shell.execute.path, async (req, res) => {
    try {
      const { command } = api.shell.execute.input.parse(req.body);
      
      let output = "";
      let status = "success";

      try {
        // Execute the command
        // Note: For security in a real app, this should be heavily restricted.
        // For this demo/tool, we execute it directly.
        // We limit the timeout to 10 seconds.
        const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
        
        if (stdout) output += stdout;
        if (stderr) output += `\nStderr:\n${stderr}`;
        
        if (!output) output = "Command executed successfully (no output)";

      } catch (error: any) {
        status = "error";
        output = error.message || "Unknown error occurred";
        if (error.stdout) output += `\nOutput:\n${error.stdout}`;
        if (error.stderr) output += `\nError Output:\n${error.stderr}`;
      }

      // Log to database
      await storage.logCommand({
        command,
        output,
        status,
      });

      res.json({ output, status });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/shell/history
  app.get(api.shell.history.path, async (req, res) => {
    try {
      const history = await storage.getCommandHistory();
      
      // Seed data if empty
      if (history.length === 0) {
        await storage.logCommand({ command: 'echo "Hello, World!"', output: 'Hello, World!', status: 'success' });
        await storage.logCommand({ command: 'whoami', output: 'replit', status: 'success' });
        await storage.logCommand({ command: 'date', output: new Date().toString(), status: 'success' });
        const newHistory = await storage.getCommandHistory();
        return res.json(newHistory.reverse());
      }

      // Reverse to show oldest first if the frontend expects a terminal flow
      res.json(history.reverse());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
