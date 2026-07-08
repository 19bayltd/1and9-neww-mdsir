/**
 * Shared inline SVG icon set for the landing sections.
 * Single source of truth — imported by the section components.
 */

export type IconName =
  | "factory"
  | "capability"
  | "moq"
  | "sampling"
  | "production"
  | "qc"
  | "shipping"
  | "capacity"
  | "fabric"
  | "gsm"
  | "printing"
  | "embroidery"
  | "labels"
  | "packaging"
  | "export"
  | "speed"
  | "support"
  | "check"
  | "design"
  | "startup"
  | "streetwear"
  | "gym"
  | "corporate"
  | "restaurant"
  | "school"
  | "medical";

export function SpecIcon({ icon, className }: { icon: IconName; className?: string }) {
  const common = {
    className: className ?? "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  switch (icon) {
    case "factory":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M4 21V10l6 4V10l6 4V6l4 2v13" />
          <path d="M8 21v-4M13 21v-4" />
        </svg>
      );
    case "capability":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </svg>
      );
    case "moq":
      return (
        <svg {...common}>
          <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M3.3 7 12 12l8.7-5M12 22V12" />
        </svg>
      );
    case "sampling":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M20 4 8.1 15.9M14.5 12.5 20 20M8.1 8.1 12 12" />
        </svg>
      );
    case "production":
      return (
        <svg {...common}>
          <rect x="2" y="14" width="20" height="6" rx="1" />
          <path d="M6 17h.01M10 17h.01M14 17h.01M18 17h.01" />
          <path d="M7 14V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5M12 7V4" />
        </svg>
      );
    case "qc":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "shipping":
      return (
        <svg {...common}>
          <path d="M3 5h11v9H3zM14 8h4l3 3v3h-7z" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="17" cy="18" r="1.6" />
        </svg>
      );
    case "capacity":
      return (
        <svg {...common}>
          <path d="M12 3 2 9l10 6 10-6z" />
          <path d="M2 15l10 6 10-6M2 12l10 6 10-6" />
        </svg>
      );
    case "fabric":
      return (
        <svg {...common}>
          <path d="M3 6c2 0 2 1.5 4 1.5S9 6 11 6s2 1.5 4 1.5S17 6 19 6" />
          <path d="M3 6v12c2 0 2 1.5 4 1.5S9 18 11 18s2 1.5 4 1.5S17 18 19 18V6" />
          <path d="M3 12c2 0 2 1.5 4 1.5S9 12 11 12s2 1.5 4 1.5S17 12 19 12" />
        </svg>
      );
    case "gsm":
      return (
        <svg {...common}>
          <path d="M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          <path d="M8.5 6h7l3 13a2 2 0 0 1-2 2.5H7.5a2 2 0 0 1-2-2.5z" />
          <path d="M9 13h6" />
        </svg>
      );
    case "printing":
      return (
        <svg {...common}>
          <path d="M6 9V3h12v6" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="7" rx="1" />
        </svg>
      );
    case "embroidery":
      return (
        <svg {...common}>
          <path d="M4 20 20 4" />
          <path d="M17 3.5 20.5 7 18 9.5 14.5 6z" />
          <circle cx="6" cy="18" r="2.4" />
        </svg>
      );
    case "labels":
      return (
        <svg {...common}>
          <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-6.2-6.2A2 2 0 0 1 4 13V5a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l6.2 6.2a2 2 0 0 1 0 2.6z" />
          <circle cx="8.5" cy="8.5" r="1.2" />
        </svg>
      );
    case "packaging":
      return (
        <svg {...common}>
          <path d="M3.3 7 12 12l8.7-5" />
          <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M12 22V12M7.5 4.5l9 5" />
        </svg>
      );
    case "export":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
        </svg>
      );
    case "speed":
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 13V9M12 5V3M9 3h6" />
        </svg>
      );
    case "support":
      return (
        <svg {...common}>
          <path d="M4 13a8 8 0 0 1 16 0" />
          <rect x="3" y="13" width="4" height="6" rx="1.5" />
          <rect x="17" y="13" width="4" height="6" rx="1.5" />
          <path d="M20 19a3 3 0 0 1-3 3h-3" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} className={className ?? "h-4 w-4"}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "design":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case "startup":
      return (
        <svg {...common}>
          <path d="M4.5 16.5 3 21l4.5-1.5" />
          <path d="M12 15c5-4 7-8.5 7-12-3.5 0-8 2-12 7l-3 1 4 4 4 4 1-3z" />
          <circle cx="14" cy="10" r="1.4" />
        </svg>
      );
    case "streetwear":
      return (
        <svg {...common}>
          <path d="M8 4 5 6l-2 4 3 1.5V20h12v-8.5L21 10l-2-4-3-2" />
          <path d="M8 4a4 4 0 0 0 8 0" />
        </svg>
      );
    case "gym":
      return (
        <svg {...common}>
          <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
        </svg>
      );
    case "corporate":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
        </svg>
      );
    case "restaurant":
      return (
        <svg {...common}>
          <path d="M5 3v8M8 3v8M6.5 11v10M5 7h3" />
          <path d="M15 3c-1.5 2-2 4-2 6 0 2 1 3 2.5 3S18 11 18 9c0-2-.5-4-2-6z" />
          <path d="M16 12v9" />
        </svg>
      );
    case "school":
      return (
        <svg {...common}>
          <path d="M12 4 2 9l10 5 10-5z" />
          <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v5" />
        </svg>
      );
    case "medical":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    default:
      return null;
  }
}
