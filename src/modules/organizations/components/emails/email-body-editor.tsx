import {
  BoldIcon,
  ChevronDownIcon,
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
} from "@qeetrix/icons";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  TextField,
  Toggle,
} from "@qeetrix/react";
import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  type FormEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import {
  emailHTMLText,
  validEmailAssetURL,
  validEmailTemplateLink,
} from "@/modules/organizations/email-template-model";

export type EmailBodyEditorHandle = { insertVariable: (value: string) => void };

type Mark = "bold" | "italic" | "underline" | "bullet" | "ordered" | "quote" | "code";
const STYLES = ["paragraph", "1", "2", "3"] as const;

/**
 * The email body: a rich-text editor (tiptap, a specialist editor the library doesn't have),
 * drawn as a filled field with its own tool row, and its language and length under it. Links may
 * be a template's own *_url variable or a web address; images only a web address (the server
 * refuses a variable in an image, and emails can't show an uploaded one).
 */
export function EmailBodyEditor({
  value,
  onChange,
  disabled,
  variables,
  labelledBy,
  footer,
  ref,
}: {
  value: string;
  onChange: (html: string, text: string) => void;
  disabled: boolean;
  variables: string[];
  labelledBy: string;
  footer?: ReactNode;
  ref?: Ref<EmailBodyEditorHandle>;
}) {
  const { t } = useTranslation("organizations");
  const formId = useId();
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
        "aria-labelledby": labelledBy,
        "aria-multiline": "true",
        class: "mail-rte-doc",
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

  const marks: { key: Mark; Icon: typeof BoldIcon; run: () => unknown }[] = [
    { key: "bold", Icon: BoldIcon, run: () => editor?.chain().focus().toggleBold().run() },
    { key: "italic", Icon: ItalicIcon, run: () => editor?.chain().focus().toggleItalic().run() },
    {
      key: "underline",
      Icon: UnderlineIcon,
      run: () => editor?.chain().focus().toggleUnderline().run(),
    },
  ];
  const blocks: typeof marks = [
    { key: "bullet", Icon: ListIcon, run: () => editor?.chain().focus().toggleBulletList().run() },
    {
      key: "ordered",
      Icon: ListOrderedIcon,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    { key: "quote", Icon: QuoteIcon, run: () => editor?.chain().focus().toggleBlockquote().run() },
    { key: "code", Icon: CodeIcon, run: () => editor?.chain().focus().toggleCodeBlock().run() },
  ];
  const off = disabled || !editor;
  const styleName = (style: string) =>
    style === "paragraph"
      ? t("emails.toolbar.paragraph")
      : t("emails.toolbar.heading", { level: Number(style) });
  const toggle = ({ key, Icon, run }: (typeof marks)[number]) => (
    <Toggle
      key={key}
      size="sm"
      icon={Icon}
      aria-label={t(`emails.toolbar.${key}`)}
      pressed={!!state?.[key]}
      disabled={off}
      onPressedChange={() => run()}
    />
  );

  const validURL =
    validEmailAssetURL(url) || (dialog === "link" && validEmailTemplateLink(url, variables));
  function insert(event: FormEvent) {
    event.preventDefault();
    if (!editor || disabled || !validURL) return;
    if (dialog === "image") editor.chain().focus().setImage({ src: url, alt: label }).run();
    else if (label)
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: label,
          marks: [
            { type: "link", attrs: { href: url, target: "_blank", rel: "noopener noreferrer" } },
          ],
        })
        .run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setDialog(null);
  }

  return (
    <div className="mail-rte" data-disabled={disabled ? "" : undefined}>
      <div role="toolbar" aria-label={t("emails.toolbar.label")} className="mail-rte-tools">
        {/* A tool row's style picker: a menu, as the row's controls are all small. */}
        <Menu>
          <MenuTrigger
            render={
              <Button
                variant="ghost"
                tone="neutral"
                size="sm"
                icon={ChevronDownIcon}
                disabled={off}
                aria-label={`${t("emails.toolbar.format")}: ${styleName(state?.heading ?? "paragraph")}`}
                className="mail-rte-style"
              >
                {styleName(state?.heading ?? "paragraph")}
              </Button>
            }
          />
          <MenuContent align="start">
            {STYLES.map((style) => (
              <MenuItem
                key={style}
                onClick={() =>
                  style === "paragraph"
                    ? editor?.chain().focus().setParagraph().run()
                    : editor
                        ?.chain()
                        .focus()
                        .toggleHeading({ level: Number(style) as 1 | 2 | 3 })
                        .run()
                }
              >
                {styleName(style)}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        {marks.map(toggle)}
        <span className="mail-rte-sep" aria-hidden="true" />
        <IconButton
          size="sm"
          variant="ghost"
          icon={LinkIcon}
          aria-label={t("emails.toolbar.link")}
          disabled={off}
          onClick={() => {
            setURL(editor?.getAttributes("link").href ?? "");
            setLabel("");
            setDialog("link");
          }}
        />
        <IconButton
          size="sm"
          variant="ghost"
          icon={ImageIcon}
          aria-label={t("emails.toolbar.image")}
          disabled={off}
          onClick={() => {
            setURL("");
            setLabel("");
            setDialog("image");
          }}
        />
        <span className="mail-rte-sep" aria-hidden="true" />
        {blocks.map(toggle)}
        <span className="mail-rte-sep" aria-hidden="true" />
        <IconButton
          size="sm"
          variant="ghost"
          icon={Undo2Icon}
          aria-label={t("emails.toolbar.undo")}
          disabled={off || !state?.undo}
          onClick={() => editor?.chain().focus().undo().run()}
        />
        <IconButton
          size="sm"
          variant="ghost"
          icon={Redo2Icon}
          aria-label={t("emails.toolbar.redo")}
          disabled={off || !state?.redo}
          onClick={() => editor?.chain().focus().redo().run()}
        />
      </div>
      <EditorContent editor={editor} />
      {footer ? <div className="mail-rte-foot">{footer}</div> : null}
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent
          size="sm"
          title={t(dialog === "image" ? "emails.toolbar.image" : "emails.toolbar.link")}
          description={t(
            dialog === "image" ? "emails.toolbar.imageHint" : "emails.toolbar.linkHint",
          )}
        >
          <DialogBody>
            <form id={formId} className="mail-dialog-form" noValidate onSubmit={insert}>
              <TextField
                label={t("emails.toolbar.url")}
                type={dialog === "image" ? "url" : "text"}
                inputMode="url"
                autoFocus
                value={url}
                placeholder={t("emails.toolbar.urlPlaceholder")}
                onChange={(event) => setURL(event.target.value)}
              />
              <TextField
                label={t(dialog === "image" ? "emails.toolbar.alt" : "emails.toolbar.linkLabel")}
                optional
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </form>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t("emails.cancel")}
            </Button>
            <Button type="submit" form={formId} disabled={disabled || !validURL}>
              {t("emails.toolbar.insert")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
