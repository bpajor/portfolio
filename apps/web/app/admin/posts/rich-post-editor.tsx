"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Bold, Code, Heading2, Heading3, Image as ImageIcon, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2, Unlink, Underline as UnderlineIcon } from "lucide-react";
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

export function RichPostEditor({ initialMarkdown = "", initialHtml = "", media = [] }: RichPostEditorProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [html, setHtml] = useState(initialHtml);
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
    }
  });
  const selectedImage = media.find((item) => item.id === selectedImageId);

  function insertSelectedImage() {
    if (!editor || !selectedImage) {
      return;
    }
    editor.chain().focus().setImage({ src: selectedImage.url, alt: selectedImage.altText }).run();
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm text-slate-300">Article editor</span>
      <div className="overflow-hidden rounded-md border border-white/10 bg-slate-950 focus-within:border-sky-300/50">
        <div className="flex flex-wrap gap-2 border-b border-white/10 bg-slate-900/80 p-2">
          <ToolbarButton label="Undo" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>
            <Undo2 size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Redo" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>
            <Redo2 size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Heading 2" isActive={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={17} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Heading 3" isActive={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
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
          <ToolbarButton label="Bullet list" isActive={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Numbered list" isActive={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Quote" isActive={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            <Quote size={16} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Code block" isActive={editor?.isActive("codeBlock")} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
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
        </div>
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror>*+*]:mt-4 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-sky-300/50 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-slate-900 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-white [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-white [&_.ProseMirror_img]:mx-auto [&_.ProseMirror_img]:max-h-[60vh] [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-md [&_.ProseMirror_img]:border [&_.ProseMirror_img]:border-white/10 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:bg-slate-900 [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6"
        />
      </div>
      <input type="hidden" name="contentMarkdown" value={markdown} />
      <input type="hidden" name="contentHtmlSanitized" value={html} />
    </div>
  );
}
