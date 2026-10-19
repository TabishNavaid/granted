"use client";

import * as React from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Bold, Italic, List, ListOrdered, Heading3, Undo2, Redo2, Quote, ChevronDown } from "lucide-react";
import { Citation, Gap } from "./extensions";
import { services } from "@/lib/services";
type ReviseTone = "plain" | "warm" | "formal" | "confident";
import type { Fact, Section } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

interface SectionEditorProps {
  section: Section;
  facts: Fact[];
  onChange: (html: string, words: number) => void;
  onCitationClick: (factId: string) => void;
  onGapClick: (gapId: string) => void;
  onVersions?: () => void;
  /** Board reviewers read and approve; they cannot change the text. */
  readOnly?: boolean;
}

function ToolbarButton({ label, active, onClick, children, disabled }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className={cn(
            "inline-flex size-9 items-center justify-center text-ink transition-colors hover:bg-paper-tint disabled:opacity-40 [&_svg]:size-4",
            active && "bg-ink text-paper hover:bg-ink",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function SectionEditor({ section, facts, onChange, onCitationClick, onGapClick, onVersions, readOnly = false }: SectionEditorProps) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [words, setWords] = React.useState(0);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    // Toolbar pressed states follow the selection, so the editor must re-render on every transaction.
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, code: false, horizontalRule: false, link: false }),
      Placeholder.configure({ placeholder: "Start writing, or ask us to draft this section from your facts." }),
      CharacterCount,
      Citation,
      Gap,
    ],
    content: section.bodyHtml,
    editorProps: {
      attributes: { class: "tiptap", "aria-label": `${section.title} editor`, role: "textbox", "aria-multiline": "true" },
      handleClickOn: (_view, _pos, node) => {
        if (node.type.name === "citation" && node.attrs.factId) {
          onCitationClick(node.attrs.factId);
          return true;
        }
        if (node.type.name === "gap" && node.attrs.gapId) {
          onGapClick(node.attrs.gapId);
          return true;
        }
        return false;
      },
      handleKeyDown: (view, event) => {
        if (event.key !== "Enter" && event.key !== " ") return false;
        const { selection } = view.state;
        const node = "node" in selection ? (selection as unknown as { node: { type: { name: string }; attrs: Record<string, string> } }).node : null;
        if (!node) return false;
        if (node.type.name === "citation") {
          onCitationClick(node.attrs.factId);
          return true;
        }
        if (node.type.name === "gap") {
          onGapClick(node.attrs.gapId);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const w = editor.storage.characterCount.words();
      setWords(w);
      onChangeRef.current(editor.getHTML(), w);
    },
    onCreate: ({ editor }) => setWords(editor.storage.characterCount.words()),
  });

  React.useEffect(() => {
    if (editor && editor.isEditable === readOnly) editor.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  // Swap content when the active section changes.
  const lastSection = React.useRef(section.id);
  React.useEffect(() => {
    if (!editor) return;
    if (lastSection.current !== section.id || editor.getHTML() !== section.bodyHtml) {
      if (lastSection.current !== section.id || editor.isEmpty) {
        editor.commands.setContent(section.bodyHtml, { emitUpdate: false });
        setWords(editor.storage.characterCount.words());
      }
      lastSection.current = section.id;
    }
  }, [editor, section.id, section.bodyHtml]);

  const runAi = async (action: "rewrite" | "shorten" | "expand" | "tone", tone?: ReviseTone) => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const scopeHtml = empty ? editor.getHTML() : editor.state.doc.textBetween(from, to, " ");
    setBusy(action === "tone" ? `Changing the tone to ${tone}` : action === "shorten" ? "Shortening" : action === "expand" ? "Expanding" : "Rewriting");
    const r = await services.applications.revise({ sectionId: section.id, html: empty ? scopeHtml : `<p>${scopeHtml}</p>`, action, tone, wordLimit: section.wordLimit });
    setBusy(null);
    if (!r.ok) {
      toast({ title: "We could not revise that", description: r.error, tone: "warning" });
      return;
    }
    const result = r.data;
    if (result.html === (empty ? scopeHtml : `<p>${scopeHtml}</p>`)) {
      toast({ title: "Kept your text", description: result.note, tone: "info" });
      return;
    }
    if (empty) {
      editor.chain().focus().setContent(result.html, { emitUpdate: true }).run();
    } else {
      editor.chain().focus().insertContentAt({ from, to }, result.html.replace(/^<p>|<\/p>$/g, "")).run();
    }
    toast({
      title: action === "tone" ? "Tone adjusted" : action === "shorten" ? "Shortened" : action === "expand" ? "Expanded" : "Rewritten",
      description: `${result.note} Every citation stayed put.`,
      action: { label: "Undo", onClick: () => editor.chain().focus().undo().run() },
    });
  };

  const insertCitation = (f: Fact) => {
    editor?.chain().focus().insertCitation({ factId: f.id, label: f.label }).run();
  };

  const limit = section.wordLimit;
  const over = limit ? words > limit : false;
  const pct = limit ? Math.min(100, (words / limit) * 100) : 0;

  return (
    <div className="flex flex-1 flex-col">
      {readOnly ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule bg-paper px-5 py-2.5 sm:px-10">
          <p className="text-sm text-ink-muted">You are reading as a board reviewer. You can approve sections; the owner or an editor makes changes.</p>
          {onVersions ? (
            <Button variant="ghost" size="sm" onClick={onVersions}>
              Versions
            </Button>
          ) : null}
        </div>
      ) : (
      <div role="toolbar" aria-label="Formatting and revision" className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-rule bg-paper px-3 py-2">
        <ToolbarButton label="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic />
        </ToolbarButton>
        <ToolbarButton label="Subheading" active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 />
        </ToolbarButton>
        <ToolbarButton label="Bulleted list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton label="Quote" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarButton label="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}>
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}>
          <Redo2 />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-5" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              Cite a fact
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
            <DropdownMenuLabel>Insert a citation</DropdownMenuLabel>
            {facts.map((f) => (
              <DropdownMenuItem key={f.id} onSelect={() => insertCitation(f)}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{f.label}</span>
                  <span className="truncate text-xs text-ink-muted">{f.value}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {onVersions ? (
          <Button variant="ghost" size="sm" onClick={onVersions}>
            Versions
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <span className="mr-1 hidden text-sm text-ink-muted sm:inline">Revise:</span>
          <Button variant="secondary" size="sm" onClick={() => runAi("rewrite")} disabled={!!busy}>
            Rewrite
          </Button>
          <Button variant="secondary" size="sm" onClick={() => runAi("shorten")} disabled={!!busy}>
            Shorten
          </Button>
          <Button variant="secondary" size="sm" onClick={() => runAi("expand")} disabled={!!busy}>
            Expand
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" disabled={!!busy}>
                Tone <ChevronDown className="size-3" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Change the tone of {editor?.state.selection.empty ? "this section" : "the selection"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(["plain", "warm", "formal", "confident"] as ReviseTone[]).map((t) => (
                <DropdownMenuItem key={t} onSelect={() => runAi("tone", t)} className="capitalize">
                  {t}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      )}

      <div className="relative flex-1 px-5 py-6 sm:px-10 sm:py-8">
        {busy ? (
          <div className="sheet-raised-sm absolute inset-x-5 top-4 z-10 px-3 py-2 text-sm text-ink sm:inset-x-10" role="status">
            {busy}
          </div>
        ) : null}
        <div className={cn("prose-editor sheet mx-auto px-6 py-7 transition-opacity sm:px-10 sm:py-9", busy && "opacity-50")}>
          <h2 className="mb-4 font-display text-2xl text-ink">{section.title}</h2>
          <EditorContent editor={editor} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-rule bg-paper px-5 py-2 text-xs text-ink-muted sm:px-10">
        {limit ? (
          <>
            <Progress value={pct} tone={over ? "danger" : pct > 90 ? "warning" : "accent"} className="w-32" aria-label="Word count against limit" />
            <span className={cn("tnum", over && "font-semibold text-alert")}>
              {words} of {limit} words{over ? `, ${words - limit} over` : ""}
            </span>
          </>
        ) : (
          <span className="tnum">{words} words</span>
        )}
      </div>
    </div>
  );
}

export type { Editor };
