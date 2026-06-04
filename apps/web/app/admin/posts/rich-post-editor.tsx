"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Bold, Code, Eye, Heading2, Heading3, Image as ImageIcon, Italic, Link2, List, ListOrdered, Pencil, Quote, Redo2, Undo2, Unlink, Underline as UnderlineIcon } from "lucide-react";
import type { AdminMediaItem } from "../media/media-model";

type RichPostEditorProps = {
  initialMarkdown?: string;
  initialHtml?: string;
  media?: AdminMediaItem[];
};

type ToolbarButtonProps = {
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

type BlockTool = "heading2" | "heading3" | "bulletList" | "orderedList" | "blockquote" | "codeBlock";

type EditorContentNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: EditorContentNode[];
  text?: string;
};

function toolbarClass(isActive?: boolean) {
  return `grid h-9 w-9 place-items-center rounded-md border text-sm transition ${
    isActive
      ? "border-sky-300/60 bg-sky-300/15 text-sky-100"
      : "border-white/10 bg-slate-950 text-slate-300 hover:border-sky-300/40 hover:text-white"
  }`;
}

function ToolbarButton({ label, isActive, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`${toolbarClass(isActive)} disabled:cursor-not-allowed disabled:opacity-40`}>
      {children}
    </button>
  );
}

function setLink(editor: Editor) {
  const previousUrl = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link URL", previousUrl ?? "");
  if (url === null) {
    return;
  }
  if (url.trim() === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim(), target: "_blank", rel: "noopener noreferrer" }).run();
}

function hasSelectedText(editor: Editor | null) {
  if (!editor) {
    return false;
  }
  const { from, to, empty } = editor.state.selection;
  return !empty && editor.state.doc.textBetween(from, to, " ").trim().length > 0;
}

function selectedText(editor: Editor) {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, "\n").trim();
}

function textContent(text: string): EditorContentNode[] {
  return text ? [{ type: "text", text }] : [];
}

function paragraphNode(text: string): EditorContentNode {
  return { type: "paragraph", content: textContent(text) };
}

function listItemNode(text: string): EditorContentNode {
  return { type: "listItem", content: [paragraphNode(text)] };
}

function blockContent(block: BlockTool, text: string): EditorContentNode {
  return {
    heading2: { type: "heading", attrs: { level: 2 }, content: textContent(text) },
    heading3: { type: "heading", attrs: { level: 3 }, content: textContent(text) },
    bulletList: { type: "bulletList", content: [listItemNode(text)] },
    orderedList: { type: "orderedList", content: [listItemNode(text)] },
    blockquote: { type: "blockquote", content: [paragraphNode(text)] },
    codeBlock: { type: "codeBlock", content: textContent(text) }
  }[block];
}

function nodeMatchesBlock(node: ProseMirrorNode, block: BlockTool) {
  return {
    heading2: node.type.name === "heading" && node.attrs.level === 2,
    heading3: node.type.name === "heading" && node.attrs.level === 3,
    bulletList: node.type.name === "bulletList",
    orderedList: node.type.name === "orderedList",
    blockquote: node.type.name === "blockquote",
    codeBlock: node.type.name === "codeBlock"
  }[block];
}

function isBlockToolNode(node: ProseMirrorNode) {
  return node.type.name === "heading" || node.type.name === "bulletList" || node.type.name === "orderedList" || node.type.name === "blockquote" || node.type.name === "codeBlock";
}

function selectedBlockRange(editor: Editor) {
  const text = selectedText(editor);
  const { $from } = editor.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (isBlockToolNode(node) && node.textContent.trim() === text) {
      return {
        from: $from.before(depth),
        to: $from.after(depth),
        node
      };
    }
  }

  return null;
}

function replaceSelectionWithBlock(editor: Editor, block: BlockTool) {
  if (!hasSelectedText(editor)) {
    return;
  }

  const text = selectedText(editor);
  const activeBlock = selectedBlockRange(editor);
  const range = activeBlock ?? {
    from: editor.state.selection.from,
    to: editor.state.selection.to
  };
  const content = activeBlock && nodeMatchesBlock(activeBlock.node, block) ? paragraphNode(text) : blockContent(block, text);

  editor.chain().focus().insertContentAt(range, content).run();
}

export function RichPostEditor({ initialMarkdown = "", initialHtml = "", media = [] }: RichPostEditorProps) {
  const imageSelectRef = useRef<HTMLSelectElement>(null);
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [html, setHtml] = useState(initialHtml);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [selectionAvailable, setSelectionAvailable] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState("");
  const editor = useEditor({
    extensions: [
      Image.configure({
        allowBase64: false
      }),
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4]
        },
        link: {
          autolink: true,
          openOnClick: false,
          HTMLAttributes: {
            rel: "noopener noreferrer",
            target: "_blank"
          }
        }
      }),
      Markdown
    ],
    content: initialHtml || initialMarkdown || "",
    contentType: initialHtml ? "html" : "markdown",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Article editor",
        role: "textbox",
        class: "min-h-80 rounded-b-md bg-slate-950 px-4 py-4 text-base leading-7 text-slate-100 outline-none"
      }
    },
    onUpdate: ({ editor: nextEditor }) => {
      const nextMarkdown = (nextEditor as Editor & { getMarkdown: () => string }).getMarkdown();
      setMarkdown(nextMarkdown.trim());
      setHtml(nextEditor.getHTML());
      setSelectionAvailable(hasSelectedText(nextEditor));
    },
    onSelectionUpdate: ({ editor: nextEditor }) => {
      setSelectionAvailable(hasSelectedText(nextEditor));
    }
  });
  const selectedImage = media.find((item) => item.id === selectedImageId);

  function insertSelectedImage() {
    const selectedId = imageSelectRef.current?.value ?? selectedImageId;
    const image = media.find((item) => item.id === selectedId);
    if (!editor || !image) {
      return;
    }
    editor.chain().focus().setImage({ src: image.url, alt: image.altText }).run();
  }
  const hasSelection = selectionAvailable && hasSelectedText(editor);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-slate-300">Article editor</span>
        <div className="inline-flex rounded-md border border-white/10 bg-slate-950 p-1">
          <button
            type="button"
            aria-pressed={mode === "edit"}
            onClick={() => setMode("edit")}
            className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm transition ${mode === "edit" ? "bg-sky-300 text-slate-950" : "text-slate-300 hover:text-white"}`}
          >
            <Pencil size={15} aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            aria-pressed={mode === "preview"}
            onClick={() => setMode("preview")}
            className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm transition ${mode === "preview" ? "bg-sky-300 text-slate-950" : "text-slate-300 hover:text-white"}`}
          >
            <Eye size={15} aria-hidden="true" />
            Preview
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-white/10 bg-slate-950 focus-within:border-sky-300/50">
        {mode === "edit" ? <div className="flex flex-wrap gap-2 border-b border-white/10 bg-slate-900/80 p-2">
          <ToolbarButton label="Undo" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>
            <Undo2 size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Redo" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>
            <Redo2 size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Heading 2" disabled={!hasSelection} isActive={editor?.isActive("heading", { level: 2 })} onClick={() => editor && replaceSelectionWithBlock(editor, "heading2")}>
            <Heading2 size={17} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Heading 3" disabled={!hasSelection} isActive={editor?.isActive("heading", { level: 3 })} onClick={() => editor && replaceSelectionWithBlock(editor, "heading3")}>
            <Heading3 size={17} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Bold" isActive={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Italic" isActive={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Underline" isActive={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Bullet list" disabled={!hasSelection} isActive={editor?.isActive("bulletList")} onClick={() => editor && replaceSelectionWithBlock(editor, "bulletList")}>
            <List size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Numbered list" disabled={!hasSelection} isActive={editor?.isActive("orderedList")} onClick={() => editor && replaceSelectionWithBlock(editor, "orderedList")}>
            <ListOrdered size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Quote" disabled={!hasSelection} isActive={editor?.isActive("blockquote")} onClick={() => editor && replaceSelectionWithBlock(editor, "blockquote")}>
            <Quote size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Code block" disabled={!hasSelection} isActive={editor?.isActive("codeBlock")} onClick={() => editor && replaceSelectionWithBlock(editor, "codeBlock")}>
            <Code size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Link" isActive={editor?.isActive("link")} onClick={() => editor && setLink(editor)}>
            <Link2 size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Remove link" disabled={!editor?.isActive("link")} onClick={() => editor?.chain().focus().unsetLink().run()}>
            <Unlink size={16} aria-hidden="true" />
          </ToolbarButton>
          <label className="flex min-w-48 items-center gap-2 text-xs text-slate-300">
            Inline image
            <select
              ref={imageSelectRef}
              value={selectedImageId}
              onChange={(event) => setSelectedImageId(event.target.value)}
              disabled={media.length === 0}
              className="h-9 min-w-40 rounded-md border border-white/10 bg-slate-950 px-2 text-sm text-slate-100 outline-none focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <option value="">Select image</option>
              {media.map((item) => (
                <option key={item.id} value={item.id}>{item.filename} - {item.altText}</option>
              ))}
            </select>
          </label>
          <ToolbarButton label="Insert image" disabled={!selectedImage || !editor} onClick={insertSelectedImage}>
            <ImageIcon size={16} aria-hidden="true" />
          </ToolbarButton>
        </div> : null}
        {mode === "edit" ? (
          <EditorContent
            editor={editor}
            className="[&_.ProseMirror>*+*]:mt-4 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-sky-300/50 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-slate-900 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-white [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-white [&_.ProseMirror_img]:mx-auto [&_.ProseMirror_img]:max-h-[60vh] [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-md [&_.ProseMirror_img]:border [&_.ProseMirror_img]:border-white/10 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:bg-slate-900 [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6"
          />
        ) : (
          <article
            aria-label="Article preview"
            className="min-h-80 px-4 py-5 text-base leading-7 text-slate-200 [&>*+*]:mt-4 [&_blockquote]:border-l-2 [&_blockquote]:border-sky-300/50 [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-slate-900 [&_code]:px-1 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-white [&_img]:mx-auto [&_img]:max-h-[60vh] [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-white/10 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-slate-900 [&_pre]:p-4 [&_ul]:list-disc [&_ul]:pl-6"
            dangerouslySetInnerHTML={{ __html: html || "<p>Nothing to preview yet.</p>" }}
          />
        )}
      </div>
      <input type="hidden" name="contentMarkdown" value={markdown} />
      <input type="hidden" name="contentHtmlSanitized" value={html} />
    </div>
  );
}
