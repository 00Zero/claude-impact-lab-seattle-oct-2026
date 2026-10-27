import { Button as BaseButton } from "@base-ui/react/button";
import Link from "next/link";
import type { ComponentProps } from "react";

// brand/brand.css: primary = basil (one per screen), secondary = sunken, quiet = text only.
const variants = {
  primary: "alt-button alt-button--primary",
  secondary: "alt-button",
  quiet: "alt-button alt-button--quiet",
  danger: "alt-button alt-button--danger",
};

type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof BaseButton> & { variant?: Variant }) {
  return <BaseButton className={`${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${variants[variant]} ${className}`} {...props} />;
}
