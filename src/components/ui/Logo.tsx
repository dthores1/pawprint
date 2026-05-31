// Centralized brand marks so a future logo swap is a one-file change.
//   • LogoMark — icon-only (no wordmark). Use alongside a "Whiskerville" text
//     label in compact surfaces like the sidebar header.
//   • LogoHero — large image with the wordmark baked in. Use standalone on
//     hero/auth screens (Splash, Login, Onboarding, AcceptInvite).

interface LogoProps {
  className?: string;
}

export function LogoMark({ className }: LogoProps) {
  return (
    <img
      src="/images/whiskerville-logo-minimum.png"
      alt="Whiskerville"
      className={className} />);


}

export function LogoHero({ className }: LogoProps) {
  return (
    <img
      src="/images/whiskerville-logo-hero.png"
      alt="Whiskerville"
      className={className} />);


}
