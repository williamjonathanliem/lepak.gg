interface SectionLabelProps {
  number: string;
  title: string;
  className?: string;
}

/** Mono section marker, e.g. "// 002 :: THE INDEX". */
export function SectionLabel({ number, title, className = '' }: SectionLabelProps) {
  return (
    <span className={`font-mono text-sm uppercase ${className}`}>{`// ${number} :: ${title}`}</span>
  );
}
