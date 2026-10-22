// A little shiny "AI" tag next to an app's name, so people spot the AI features.
// Same rainbow foil as the holo sticker (see .ai-tag in styles/index.css).

export function AiTag({ className = '' }: { className?: string }) {
  return (
    <span className={`ai-tag ${className}`}>
      <span aria-hidden="true">✦ AI</span>
      <span className="sr-only">Uses AI.</span>
    </span>
  );
}
