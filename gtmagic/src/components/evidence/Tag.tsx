export function Tag({ text, variant }: { text: string; variant?: string }) {
  return <span className={variant ? `tag ${variant}` : "tag"}>{text}</span>;
}
