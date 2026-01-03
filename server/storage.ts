import { commandHistory, type InsertCommand, type CommandLog } from "@shared/schema";
import { db } from "./db";
import { desc } from "drizzle-orm";

export interface IStorage {
  logCommand(command: InsertCommand): Promise<CommandLog>;
  getCommandHistory(): Promise<CommandLog[]>;
}

export class DatabaseStorage implements IStorage {
  async logCommand(insertCommand: InsertCommand): Promise<CommandLog> {
    const [log] = await db
      .insert(commandHistory)
      .values(insertCommand)
      .returning();
    return log;
  }

  async getCommandHistory(): Promise<CommandLog[]> {
    return await db
      .select()
      .from(commandHistory)
      .orderBy(desc(commandHistory.createdAt))
      .limit(100); // Limit to last 100 commands
  }
}

export const storage = new DatabaseStorage();
