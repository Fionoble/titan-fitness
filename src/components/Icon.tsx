interface IconProps {
  name: string;
  class?: string;
  filled?: boolean;
  size?: string;
}

export function Icon({ name, class: cls = '', filled = false, size }: IconProps) {
  const style = filled ? { fontVariationSettings: "'FILL' 1" } : undefined;
  return (
    <span
      class={`material-symbols-outlined ${cls}`}
      style={{ ...style, fontSize: size }}
    >
      {name}
    </span>
  );
}
