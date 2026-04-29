'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';

interface RichContentProps {
  content: any;
  className?: string;
}

export function RichContent({ content, className }: RichContentProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: true, HTMLAttributes: { class: 'text-blue-600 underline' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `prose prose-gray max-w-none ${className ?? ''}`,
      },
    },
  });

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
