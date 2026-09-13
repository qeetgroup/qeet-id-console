import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@qeetrix/ui";
import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  CodeIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  Redo2Icon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react";
import { type Ref, useEffect, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";

import { emailHTMLText, validEmailAssetURL, validEmailTemplateLink } from "../email-template-model";

export type EmailBodyEditorHandle = { insertVariable: (value: string) => void };

export function EmailBodyEditor({
  value,
  onChange,
  disabled,
  variables,
  ref,
}: {
  value: string;
  onChange: (html: string, text: string) => void;
  disabled: boolean;
  variables: string[];
  ref?: Ref<EmailBodyEditorHandle>;
}) {
  const { t } = useTranslation("settings");
  const [dialog, setDialog] = useState<"link" | "image" | null>(null);
  const [url, setURL] = useState("");
  const [label, setLabel] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          isAllowedUri: (url, context) =>
            validEmailTemplateLink(url, variables) || context.defaultValidate(url),
        },
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({ allowBase64: false }),
    ],
    content: value,
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": t("emails.fields.body"),
        "aria-multiline": "true",
        class:
          "min-h-60 px-3 py-3 text-xs leading-6 outline-none wrap-break-word [&_p]:mb-3 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_blockquote]:border-s-2 [&_blockquote]:border-primary [&_blockquote]:ps-3 [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_a]:text-primary [&_a]:underline [&_img]:h-auto [&_img]:max-w-full",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), emailHTMLText(editor.getHTML())),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            underline: editor.isActive("underline"),
            bullet: editor.isActive("bulletList"),
            ordered: editor.isActive("orderedList"),
            quote: editor.isActive("blockquote"),
            code: editor.isActive("codeBlock"),
            heading: editor.isActive("heading")
              ? String(editor.getAttributes("heading").level)
              : "paragraph",
            undo: editor.can().undo(),
            redo: editor.can().redo(),
          }
        : null,
  });
  useEffect(() => {
    if (editor && value !== editor.getHTML())
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  useImperativeHandle(
    ref,
    () => ({
      insertVariable: (token) => {
        if (!disabled) editor?.chain().focus().insertContent({ type: "text", text: token }).run();
      },
    }),
    [editor, disabled],
  );
  const tools = [
    {
      key: "bold",
      Icon: BoldIcon,
      active: state?.bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      key: "italic",
      Icon: ItalicIcon,
      active: state?.italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      key: "underline",
      Icon: UnderlineIcon,
      active: state?.underline,
      run: () => editor?.chain().focus().toggleUnderline().run(),
    },
    {
      key: "link",
      Icon: LinkIcon,
      run: () => {
        setURL(editor?.getAttributes("link").href ?? "");
        setLabel("");
        setDialog("link");
      },
    },
    {
      key: "image",
      Icon: ImageIcon,
      run: () => {
        setURL("");
        setLabel("");
        setDialog("image");
      },
    },
    {
      key: "bullet",
      Icon: ListIcon,
      active: state?.bullet,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      key: "ordered",
      Icon: ListOrderedIcon,
      active: state?.ordered,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      key: "quote",
      Icon: QuoteIcon,
      active: state?.quote,
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      key: "code",
      Icon: CodeIcon,
      active: state?.code,
      run: () => editor?.chain().focus().toggleCodeBlock().run(),
    },
    {
      key: "undo",
      Icon: Undo2Icon,
      disabled: !state?.undo,
      run: () => editor?.chain().focus().undo().run(),
    },
    {
      key: "redo",
      Icon: Redo2Icon,
      disabled: !state?.redo,
      run: () => editor?.chain().focus().redo().run(),
    },
  ];
  const validURL =
    validEmailAssetURL(url) || (dialog === "link" && validEmailTemplateLink(url, variables));
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-border/70 bg-background/20 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/40">
      <div
        role="toolbar"
        aria-label={t("emails.toolbar.label")}
        className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/15 p-1"
      >
        <Select
          value={state?.heading ?? "paragraph"}
          disabled={disabled || !editor}
          onValueChange={(next) =>
            next === "paragraph"
              ? editor?.chain().focus().setParagraph().run()
              : editor
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: Number(next) as 1 | 2 | 3 })
                  .run()
          }
        >
          <SelectTrigger
            aria-label={t("emails.toolbar.format")}
            className="h-7 w-25 border-0 bg-transparent px-1.5 text-[10px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paragraph">{t("emails.toolbar.paragraph")}</SelectItem>
            {[1, 2, 3].map((level) => (
              <SelectItem key={level} value={String(level)}>
                {t("emails.toolbar.heading", { level })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tools.map(({ key, Icon, run, active, disabled: unavailable }) => (
          <Tooltip key={key}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={t(`emails.toolbar.${key}`)}
                  aria-pressed={active}
                  disabled={disabled || !editor || unavailable}
                  onClick={run}
                  className={cn(
                    "grid size-7 shrink-0 cursor-pointer place-items-center rounded focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:size-10",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                />
              }
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>{t(`emails.toolbar.${key}`)}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <EditorContent editor={editor} />
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t(dialog === "image" ? "emails.toolbar.image" : "emails.toolbar.link")}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!editor || disabled || !validURL) return;
              if (dialog === "image")
                editor.chain().focus().setImage({ src: url, alt: label }).run();
              else if (label)
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "text",
                    text: label,
                    marks: [
                      {
                        type: "link",
                        attrs: { href: url, target: "_blank", rel: "noopener noreferrer" },
                      },
                    ],
                  })
                  .run();
              else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
              setDialog(null);
            }}
          >
            <label className="block text-xs" htmlFor="email-editor-url">
              {t("emails.toolbar.url")}
            </label>
            <Input
              id="email-editor-url"
              type={dialog === "image" ? "url" : "text"}
              inputMode="url"
              required
              value={url}
              onChange={(event) => setURL(event.target.value)}
              placeholder="https://example.com"
            />
            <label className="block text-xs" htmlFor="email-editor-label">
              {t(dialog === "image" ? "emails.toolbar.alt" : "emails.toolbar.linkLabel")}
            </label>
            <Input
              id="email-editor-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                {t("emails.cancel")}
              </Button>
              <Button type="submit" disabled={disabled || !validURL}>
                {t("emails.toolbar.insert")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
