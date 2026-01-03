import { CommandLog } from "@shared/schema";
import { Check, X } from "lucide-react";
import { format } from "date-fns";

interface CommandOutputProps {
  entry: CommandLog;
}

export function CommandOutput({ entry }: CommandOutputProps) {
  return (
    <div className="mb-4 group">
      {/* Command Line */}
      <div className="flex items-start text-muted-foreground mb-1">
        <span className="mr-3 select-none text-primary/70">visitor@terminal:~$</span>
        <span className="text-foreground/90 font-medium">{entry.command}</span>
        <span className="ml-auto text-xs opacity-30 select-none">
          {entry.createdAt && format(new Date(entry.createdAt), "HH:mm:ss")}
        </span>
      </div>

      {/* Output Block */}
      <div className={`
        relative pl-4 border-l-2 ml-2 py-1
        ${entry.status === 'success' ? 'border-primary/30' : 'border-destructive/50'}
      `}>
        {entry.status === 'error' && (
          <div className="absolute -left-[9px] top-0 bg-background text-destructive">
            <X className="w-4 h-4" />
          </div>
        )}
        
        <pre className={`
          font-mono whitespace-pre-wrap break-all text-sm leading-relaxed
          ${entry.status === 'error' ? 'text-destructive' : 'text-primary/90'}
        `}>
          {entry.output || <span className="italic opacity-50">No output</span>}
        </pre>
      </div>
    </div>
  );
}
