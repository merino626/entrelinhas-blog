'use client';

import { useCallback, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Youtube from '@tiptap/extension-youtube';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { api } from '@/lib/api';
import { Spinner } from './ui';

const lowlight = createLowlight(common);

export interface EditorPayload {
  json: Record<string, unknown>;
  html: string;
}

function ToolbarButton({
  onClick,
  active = false,
  title,
  children,
  disabled = false,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md px-2 py-1 text-sm font-medium transition-colors disabled:opacity-40 ${
        active
          ? 'bg-accent-soft text-accent dark:bg-accent/25 dark:text-accent-dark'
          : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, uploading }: { editor: Editor; uploading: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const addImage = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { url } = await api.upload<{ url: string }>('/media/upload', file);
    editor.chain().focus().setImage({ src: url }).run();
  };

  const addLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL do link:', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  const addVideo = () => {
    const url = window.prompt('URL do vídeo (YouTube):');
    if (url) editor.commands.setYoutubeVideo({ src: url });
  };

  return (
    <div className="sticky top-16 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-stone-200 bg-stone-50/95 px-2 py-1.5 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95">
      <ToolbarButton title="Negrito (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton title="Itálico (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton title="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-stone-300 dark:bg-stone-700" />
      <ToolbarButton title="Título" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </ToolbarButton>
      <ToolbarButton title="Subtítulo" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-stone-300 dark:bg-stone-700" />
      <ToolbarButton title="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • Lista
      </ToolbarButton>
      <ToolbarButton title="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1. Lista
      </ToolbarButton>
      <ToolbarButton title="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        “ ”
      </ToolbarButton>
      <ToolbarButton title="Bloco de código" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        {'</>'}
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-stone-300 dark:bg-stone-700" />
      <ToolbarButton title="Link" active={editor.isActive('link')} onClick={addLink}>
        🔗
      </ToolbarButton>
      <ToolbarButton title="Imagem" onClick={addImage} disabled={uploading}>
        {uploading ? <Spinner className="size-3" /> : '🖼️'}
      </ToolbarButton>
      <ToolbarButton title="Vídeo do YouTube" onClick={addVideo}>
        ▶️
      </ToolbarButton>
      <ToolbarButton title="Linha divisória" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        —
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-stone-300 dark:bg-stone-700" />
      <ToolbarButton title="Desfazer" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        ↩
      </ToolbarButton>
      <ToolbarButton title="Refazer" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        ↪
      </ToolbarButton>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e)} />
    </div>
  );
}

export function TiptapEditor({
  initialContent,
  onChange,
}: {
  initialContent?: Record<string, unknown> | null;
  onChange: (payload: EditorPayload) => void;
}) {
  const uploadingRef = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Image.configure({ inline: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['https', 'http', 'mailto'],
      }),
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      Placeholder.configure({ placeholder: 'Escreva algo incrível…' }),
    ],
    content: (initialContent as object) ?? '',
    editorProps: {
      attributes: {
        class: 'tiptap post-prose px-5 py-4',
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange({ json: e.getJSON() as Record<string, unknown>, html: e.getHTML() });
    },
  });

  const handlePasteImage = useCallback(() => {
    // Upload por colagem fica para versão futura; colar URL de imagem funciona
  }, []);

  if (!editor) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-stone-200 dark:border-stone-700">
        <Spinner />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900"
      onPaste={handlePasteImage}
    >
      <Toolbar editor={editor} uploading={uploadingRef.current} />
      <EditorContent editor={editor} />
    </div>
  );
}
