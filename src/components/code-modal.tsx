"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy, Code2, Clock } from "lucide-react";

interface CodeModalProps {
  userDisplayName: string;
  username: string;
  problemTitle: string;
  difficulty: string;
  language: string | null;
  code: string | null;
  solvedAt: string;
}

function normalizeLanguage(lang: string | null): string {
  if (!lang) return "typescript";
  const l = lang.toLowerCase().trim();
  const map: Record<string, string> = {
    python3: "python",
    python: "python",
    py: "python",
    cpp: "cpp",
    "c++": "cpp",
    c: "c",
    java: "java",
    javascript: "javascript",
    js: "javascript",
    typescript: "typescript",
    ts: "typescript",
    csharp: "csharp",
    "c#": "csharp",
    golang: "go",
    go: "go",
    rust: "rust",
    kotlin: "kotlin",
    swift: "swift",
    ruby: "ruby",
    scala: "scala",
    php: "php",
    sql: "sql",
    mysql: "sql",
    postgres: "sql",
    postgresql: "sql",
  };
  return map[l] || l;
}

export function CodeModal({
  userDisplayName,
  username,
  problemTitle,
  difficulty,
  language,
  code,
  solvedAt,
}: CodeModalProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTime = React.useMemo(() => {
    try {
      return new Date(solvedAt).toLocaleString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return solvedAt;
    }
  }, [solvedAt]);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="xs"
            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
          />
        }
      >
        <span>👁️ Kod</span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Code2 className="size-4 text-primary" />
              <span>{problemTitle}</span>
              <Badge variant="secondary" className="text-xs">
                {difficulty}
              </Badge>
            </DialogTitle>

            <div className="flex items-center gap-2">
              {language && (
                <Badge variant="outline" className="font-mono text-xs uppercase">
                  {language}
                </Badge>
              )}
              {code && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleCopy}
                  className="gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="size-3 text-emerald-400" />
                      <span>Skopiowano</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      <span>Kopiuj kod</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <DialogDescription className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <span>
              Autor:{" "}
              <strong className="text-foreground">{userDisplayName}</strong>{" "}
              <span className="font-mono text-muted-foreground">
                (@{username})
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              Zaliczono: {formattedTime}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto rounded-lg border border-border/60 bg-[#282c34]">
          {code ? (
            <SyntaxHighlighter
              language={normalizeLanguage(language)}
              style={oneDark}
              showLineNumbers
              customStyle={{
                margin: 0,
                padding: "1rem",
                fontSize: "0.82rem",
                lineHeight: "1.55",
                background: "transparent",
              }}
            >
              {code}
            </SyntaxHighlighter>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 text-center text-sm text-zinc-400">
              <Code2 className="mb-2 size-8 opacity-50" />
              <p>Zadanie zostało zaliczone (Accepted), ale treść kodu nie była dostępna w odpowiedzi z API LeetCode.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
