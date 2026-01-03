import { useEffect, useRef, useState } from "react";
import { useCommandHistory, useExecuteCommand } from "@/hooks/use-shell";
import { TerminalPrompt } from "@/components/TerminalPrompt";
import { CommandOutput } from "@/components/CommandOutput";
import { Terminal as TerminalIcon, Wifi, Battery, Command } from "lucide-react";
import { CommandLog } from "@shared/schema";

export default function Terminal() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: history, isLoading: isHistoryLoading } = useCommandHistory();
  const execute = useExecuteCommand();
  const [localHistory, setLocalHistory] = useState<CommandLog[]>([]);

  // Sync server history to local state
  useEffect(() => {
    if (history) {
      setLocalHistory(history);
    }
  }, [history]);

  // Scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localHistory, execute.isPending]);

  const handleCommand = (cmd: string) => {
    if (cmd.trim() === 'clear') {
      setLocalHistory([]);
      return;
    }

    // Optimistic update
    const optimisticId = Date.now();
    const optimisticEntry: CommandLog = {
      id: optimisticId,
      command: cmd,
      output: null,
      status: 'success', // temporary
      createdAt: new Date(),
    };
    
    // We don't add to local history immediately to avoid flicker, 
    // relying on the query invalidation to fetch the real result.
    // However, for immediate feedback on "long" commands, we could show a pending state.
    
    execute.mutate(cmd, {
      onSuccess: (data) => {
        // The query invalidation will handle the history update,
        // but if we wanted to be purely client-side for a moment:
        // const resultEntry = { ...optimisticEntry, output: data.output, status: data.status };
        // setLocalHistory(prev => [...prev, resultEntry as CommandLog]);
      },
      onError: (err) => {
        const errorEntry: CommandLog = {
          ...optimisticEntry,
          output: err.message,
          status: 'error'
        };
        // Force add error entry since it might not be in server DB depending on implementation
        // But our backend stores everything, so invalidation should cover it.
      }
    });
  };

  return (
    <div className="h-screen w-screen bg-background text-foreground font-mono flex flex-col overflow-hidden relative scanline">
      {/* CRT Overlay Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)] pointer-events-none z-50" />
      <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03] bg-repeat mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />

      {/* Header / Status Bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-primary/20 bg-background/95 backdrop-blur z-10 text-xs uppercase tracking-widest text-primary/60 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-primary text-glow">
            <TerminalIcon className="w-4 h-4" />
            <span className="font-bold">SYSTEM_ROOT</span>
          </div>
          <span className="hidden sm:inline-block opacity-50">|</span>
          <span className="hidden sm:inline-block">v1.0.4-stable</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            <span>CONNECTED</span>
          </div>
          <div className="flex items-center gap-2">
            <Battery className="w-4 h-4" />
            <span>100%</span>
          </div>
          <div className="text-primary font-bold">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>

      {/* Terminal Window */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-smooth crt-flicker"
      >
        {/* Welcome Message */}
        <div className="mb-8 text-primary/80 leading-relaxed max-w-2xl">
          <pre className="font-bold text-xs sm:text-sm mb-4 text-glow select-none">
{`
   _____ __  __ ______ _      _      
  / ____|  \\/  |  ____| |    | |     
 | (___ | \\  / | |__  | |    | |     
  \\___ \\| |\\/| |  __| | |    | |     
  ____) | |  | | |____| |____| |____ 
 |_____/|_|  |_|______|______|______|
                                     
`}
          </pre>
          <p className="mb-2">Welcome to the interactive system shell.</p>
          <p className="opacity-70 text-sm">Type a command to execute it on the server.</p>
          <p className="opacity-70 text-sm mt-1">Try: <span className="text-primary font-bold bg-primary/10 px-1 rounded">ls -la</span>, <span className="text-primary font-bold bg-primary/10 px-1 rounded">date</span>, or <span className="text-primary font-bold bg-primary/10 px-1 rounded">echo "hello world"</span>.</p>
          <p className="opacity-50 text-xs mt-4 border-t border-primary/20 pt-2 w-fit">WARNING: UNAUTHORIZED ACCESS IS PROHIBITED. ALL COMMANDS ARE LOGGED.</p>
        </div>

        {/* History */}
        {isHistoryLoading ? (
          <div className="text-primary/50 animate-pulse text-sm">Loading system logs...</div>
        ) : (
          localHistory.map((entry) => (
            <CommandOutput key={entry.id} entry={entry} />
          ))
        )}

        {/* Active Input */}
        <div className="pb-12">
          <TerminalPrompt onSubmit={handleCommand} isLoading={execute.isPending} />
        </div>
      </div>

      {/* Footer Hint */}
      <div className="absolute bottom-4 right-6 pointer-events-none opacity-30 text-[10px] sm:text-xs">
        <span className="mr-2">CTRL+L to clear</span>
        <span>Status: {execute.isPending ? 'EXECUTING...' : 'IDLE'}</span>
      </div>
    </div>
  );
}
