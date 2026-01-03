import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const commandHistory = pgTable("command_history", {
  id: serial("id").primaryKey(),
  command: text("command").notNull(),
  output: text("output"),
  status: text("status").notNull(), // 'success' or 'error'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommandSchema = createInsertSchema(commandHistory).omit({ 
  id: true, 
  createdAt: true 
});

export type InsertCommand = z.infer<typeof insertCommandSchema>;
export type CommandLog = typeof commandHistory.$inferSelect;
