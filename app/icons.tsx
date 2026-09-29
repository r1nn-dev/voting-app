// Small stroke icons, sized by the surrounding text (1em).

type IconProps = { className?: string };

function Svg({ className = "size-4", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export const ClockIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m5 12 5 5 9-10" />
  </Svg>
);

export const PlusIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const XIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const ArchiveIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="4" width="18" height="5" rx="1.5" />
    <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
  </Svg>
);

/** The app mark: a check, as in casting a vote. */
export function LogoMark({ className = "size-7" }: IconProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm dark:bg-indigo-500 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-[60%]">
        <path d="m6.5 12.5 3.5 3.5 7.5-8" />
      </svg>
    </span>
  );
}
