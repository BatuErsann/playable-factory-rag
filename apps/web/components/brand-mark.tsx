export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5" aria-label="Playable Factory">
      <svg
        viewBox="0 0 50 42"
        className="h-[38px] w-[45px] shrink-0"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M28.5 3.5 32 6l4.1-.5 1.7 3.8 3.7 1.8-.6 4.1 2.5 3.3-2.5 3.4.6 4.1-3.7 1.8-1.7 3.8-4.1-.5-3.5 2.5-3.4-2.5-4.2.5-1.7-3.8-3.7-1.8.6-4.1-2.5-3.4 2.5-3.3-.6-4.1 3.7-1.8 1.7-3.8 4.2.5 3.4-2.5Z"
          stroke="white"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M4.2 8.4a2.8 2.8 0 0 1 4.2-2.38l20.2 12.6a2.8 2.8 0 0 1 0 4.76L8.4 35.98A2.8 2.8 0 0 1 4.2 33.6V8.4Z"
          fill="#ff9000"
        />
      </svg>
      <span className="text-[17px] font-extrabold uppercase leading-[0.92] tracking-[-0.035em] text-white">
        <span className="block">Playable</span>
        <span className="block">Factory</span>
      </span>
    </div>
  );
}
