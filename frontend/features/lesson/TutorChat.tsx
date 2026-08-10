"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { askTutor, type TutorTurn } from "@/services/lessons.service";
import { toErrorMessage } from "@/services/api";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  "Explain this more simply",
  "Give me a real-life example",
  "Give me an analogy for this",
  "Quiz me on this part",
];

interface TutorChatProps {
  lessonId: string;
  /** The slide the learner is currently watching (from the video position). */
  currentSlideIndex: number;
  currentSlideTitle: string | null;
  /** Set by clicking a board term — auto-sends when the nonce changes. */
  injected?: { text: string; nonce: number } | null;
}

/**
 * The in-video AI tutor. Unique mechanic: it tracks the video position, so
 * "I don't get this" means the exact concept on screen — no copy-pasting,
 * no explaining where you're stuck.
 */
export function TutorChat({ lessonId, currentSlideIndex, currentSlideTitle, injected }: TutorChatProps) {
  const [messages, setMessages] = useState<TutorTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const lastInjectedNonce = useRef<number>(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || pendingRef.current) return;
      pendingRef.current = true;
      setError(null);
      setInput("");
      const nextMessages: TutorTurn[] = [...messages, { role: "user", content: message }];
      setMessages(nextMessages);
      setPending(true);
      try {
        const response = await askTutor(lessonId, message, currentSlideIndex, nextMessages.slice(-8));
        setMessages((prev) => [...prev, { role: "tutor", content: response.reply }]);
      } catch (caught) {
        setError(toErrorMessage(caught));
        setMessages((prev) => prev.slice(0, -1));
        setInput(message);
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [lessonId, currentSlideIndex, messages]
  );

  // A board term was clicked → auto-ask about it.
  useEffect(() => {
    if (injected && injected.nonce !== lastInjectedNonce.current) {
      lastInjectedNonce.current = injected.nonce;
      void send(injected.text);
    }
  }, [injected, send]);

  return (
    <Card className="flex h-full max-h-[560px] flex-col border-secondary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-5 w-5 text-secondary" /> Ask your tutor
        </CardTitle>
        {currentSlideTitle && (
          <Badge variant="secondary" className="w-fit max-w-full">
            <span className="truncate">Watching: {currentSlideTitle}</span>
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-0">
        <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
              Stuck on something? I know exactly where you are in the video — just ask, or tap a
              shortcut below.
            </p>
          )}
          {messages.map((turn, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm",
                turn.role === "user"
                  ? "ml-auto rounded-br-md bg-primary/20 text-foreground"
                  : "mr-auto rounded-bl-md bg-muted/60"
              )}
            >
              {turn.content}
            </motion.div>
          ))}
          {pending && (
            <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted/60 px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              disabled={pending}
              onClick={() => send(action)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-secondary/60 hover:text-foreground disabled:opacity-50"
            >
              {action}
            </button>
          ))}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask anything about this lesson…"
            disabled={pending}
            className="h-10 flex-1 rounded-xl border border-input bg-background/60 px-3.5 text-sm placeholder:text-muted-foreground focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
