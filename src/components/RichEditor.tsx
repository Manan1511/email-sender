import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { LinkSimple, ListBullets, ListNumbers, TextB, TextItalic, TextUnderline } from '@phosphor-icons/react'

type Props = { value: string; onChange: (html: string) => void; placeholderNames: string[] }

export function RichEditor({ value, onChange, placeholderNames }: Props) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true })],
    content: value,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'rich-editor-content', 'aria-label': 'Email message' } },
    onUpdate: ({ editor: updated }) => onChange(updated.getHTML()),
  })

  useEffect(() => {
    if (editor && editor.getHTML() !== value) editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  if (!editor) return <div className="editor-loading" aria-label="Loading message editor" />
  const actions = [
    { label: 'Bold', icon: TextB, active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { label: 'Italic', icon: TextItalic, active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { label: 'Underline', icon: TextUnderline, active: editor.isActive('underline'), run: () => editor.chain().focus().toggleUnderline().run() },
    { label: 'Bulleted list', icon: ListBullets, active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Numbered list', icon: ListNumbers, active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Link', icon: LinkSimple, active: editor.isActive('link'), run: () => {
      const current = editor.getAttributes('link').href as string | undefined
      const href = window.prompt('Link address', current || 'https://')
      if (href === null) return
      if (!href.trim()) editor.chain().focus().unsetLink().run()
      else editor.chain().focus().setLink({ href: href.trim() }).run()
    } },
  ]

  return <div className="editor-shell">
    <div className="editor-toolbar" role="toolbar" aria-label="Message formatting">
      {actions.map(({ label, icon: Icon, active, run }) => <button className={`toolbar-button ${active ? 'is-active' : ''}`} type="button" aria-label={label} title={label} key={label} onClick={run}><Icon weight="bold" size={17} /></button>)}
      <span className="toolbar-divider" />
      <label className="placeholder-insert"><span>Insert field</span><select aria-label="Insert placeholder" value="" onChange={(event) => { if (event.target.value) editor.chain().focus().insertContent(`[${event.target.value}]`).run() }}><option value="">Choose…</option>{placeholderNames.map((name) => <option key={name} value={name}>[{name}]</option>)}</select></label>
    </div>
    <EditorContent editor={editor} />
  </div>
}
