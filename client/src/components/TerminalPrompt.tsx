import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface TerminalPromptProps {
  onSubmit: (cmd: string) => void;
  isLoading: boolean;
}

export function TerminalPrompt({ onSubmit, isLoading }: TerminalPromptProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep focus on input
  useEffect(() => {
    const focusInput = () => inputRef.current?.focus();
    window.addEventListener("click", focusInput);
    return () => window.removeEventListener("click", focusInput);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    onSubmit(input);
    setInput("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center w-full mt-2">
      <span className="text-primary mr-3 font-bold select-none text-glow">visitor@terminal:~$</span>
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full bg-transparent border-none outline-none text-foreground font-mono placeholder:text-muted-foreground focus:ring-0 p-0 m-0"
          autoFocus
          autoComplete="off"
          disabled={isLoading}
        />
        {/* Blinking cursor effect (only visible when not typing or at end) */}
        {!isLoading && (
          <span 
            className="absolute top-0 bottom-0 w-2.5 bg-primary animate-pulse pointer-events-none"
            style={{ left: `${input.length * 9.6}px` }} // Approximate char width for monospace
          />
        )}
      </div>
      {isLoading && <Loader2 className="w-4 h-4 text-primary animate-spin ml-2" />}
    </form>
  );
}
