import Image from "next/image";

export function SlackIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Image
      src="/slack-icon.svg"
      alt="Slack"
      width={16}
      height={16}
      className={className}
      unoptimized
    />
  );
}
