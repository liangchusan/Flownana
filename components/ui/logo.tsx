import Image from "next/image";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  textColor?: string;
}

export function Logo({ className = "", showText = true, size = "md", textColor }: LogoProps) {
  const logoSizes = { sm: "w-32", md: "w-36", lg: "w-48" };
  const markSizes = { sm: "h-6 w-6", md: "h-8 w-8", lg: "h-12 w-12" };
  const lightText = textColor === "text-white";

  return (
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      {showText && !lightText ? (
        <Image
          src="/brand/flownana-logo.png"
          alt="Flownana"
          width={808}
          height={181}
          className={`${logoSizes[size]} h-auto max-w-full`}
          unoptimized
        />
      ) : showText ? (
        <span role="img" aria-label="Flownana" className={`${logoSizes[size]} inline-flex items-center gap-1`}>
          <Image src="/brand/flownana-mark.png" alt="" width={512} height={362} className="h-auto w-[32%]" unoptimized />
          <Image src="/brand/flownana-wordmark.png" alt="" width={534} height={99} className="h-auto min-w-0 flex-1 brightness-0 invert" unoptimized />
        </span>
      ) : (
        <Image src="/brand/flownana-mark.png" alt="Flownana" width={512} height={362} className={`${markSizes[size]} object-contain`} unoptimized />
      )}
    </span>
  );
}
