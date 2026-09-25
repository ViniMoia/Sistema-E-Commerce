import Link from "next/link";
import Image from "next/image";

interface ContinentalLogoProps {
  className?: string;
  variant?: "horizontal" | "symbol" | "full";
  priority?: boolean;
  href?: string;
}

export function ContinentalLogo({
  className = "h-10 sm:h-11 md:h-12 w-auto",
  variant = "symbol",
  priority = true,
  href = "/",
}: ContinentalLogoProps) {
  const src =
    variant === "symbol"
      ? "/brand/continental-symbol.png"
      : variant === "full"
      ? "/brand/continental-logo-full.png"
      : "/brand/continental-logo-horizontal.png";

  const dimensions =
    variant === "symbol"
      ? { width: 374, height: 425 }
      : variant === "full"
      ? { width: 1075, height: 724 }
      : { width: 644, height: 200 };

  return (
    <Link
      href={href}
      className="inline-flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow/60 rounded-sm"
      aria-label="Continental Produtos Estéticos Automotivos - Página Inicial"
    >
      <div className="relative flex items-center">
        <Image
          src={src}
          alt="Continental Produtos Estéticos Automotivos"
          width={dimensions.width}
          height={dimensions.height}
          priority={priority}
          className={`${className} object-contain transition-transform duration-300 group-hover:scale-[1.015]`}
        />
      </div>
    </Link>
  );
}
