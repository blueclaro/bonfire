type NoticePreviewProps = {
  title: string;
  text: string;
};

export default function NoticePreview({ title, text }: NoticePreviewProps) {
  return (
    <div className="border-b border-white/10 py-4">
      <strong>{title}</strong>
      <p className="mt-1 text-sm text-[#b9aaa0]">{text}</p>
    </div>
  );
}