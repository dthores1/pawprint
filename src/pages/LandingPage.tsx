import { Link } from 'react-router-dom';
import {
  PawPrint,
  Home,
  Stethoscope,
  Heart,
  Users,
  Package,
  ArrowRight,
  Mail } from
'lucide-react';
import { LogoMark, LogoHero } from '../components/ui/Logo';

// Public marketing landing page. Rendered as the signed-out front door at "/"
// (see App.tsx Gate) and reachable without a session. Content mirrors
// public/landing.md; styling uses the shared Whiskerville tokens
// (tailwind.config.js) so it coheres with the authenticated app.

const FEATURES = [
{
  icon: PawPrint,
  title: 'Animal Management',
  body:
  'Track animals throughout their rescue journey — intake information, medical history, photos, notes, and adoption status.'
},
{
  icon: Home,
  title: 'Foster Management',
  body:
  'Manage foster placements, applications, and availability while keeping a complete history of each animal’s placements.'
},
{
  icon: Stethoscope,
  title: 'Medical Records',
  body:
  'Record vaccinations, spay/neuter procedures, medications, clinic visits, and other important medical information.'
},
{
  icon: Heart,
  title: 'Adoptions',
  body:
  'Track adoption applications, approved adopters, adoption outcomes, and post-adoption records.'
},
{
  icon: Users,
  title: 'Volunteer & Org Collaboration',
  body:
  'Invite team members, assign responsibilities, and securely share information across your rescue organization.'
},
{
  icon: Package,
  title: 'Supplies & Operations',
  body:
  'Manage supply requests, transportation requests, and other operational workflows that keep rescues running.'
}];


// Primary CTA styled as a Link (the shared Button renders a <button>, which
// can't legally wrap navigation). Mirrors Button's primary/lg styling.
const primaryCta =
'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 bg-primary text-white hover:bg-primary-hover h-12 px-6 text-lg shadow-soft';
const softCta =
'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 bg-white/75 border border-border text-text-primary hover:bg-white hover:border-[#C9C3B6] hover:shadow-soft h-12 px-6 text-lg';

export function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Nav */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Whiskerville home">
            <LogoMark className="w-9 h-9" />
            <span className="font-heading font-bold text-lg text-text-primary">
              Whiskerville
            </span>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 bg-primary text-white hover:bg-primary-hover h-10 px-5">
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-medium text-secondary mb-6">
              <PawPrint className="w-4 h-4" />
              Animal Rescue Management Software
            </span>
            <h1 className="font-heading font-extrabold tracking-tight text-4xl sm:text-5xl lg:text-[3.25rem] leading-[1.1] text-text-primary">
              Spend less time on spreadsheets, more time saving animals.
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed max-w-xl">
              Whiskerville brings your rescue's animals, fosters, adoptions, medical records, volunteers, and operations together in one place — so you can focus on animals instead of administration.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/login" className={primaryCta}>
                Sign In
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#features" className={softCta}>
                Explore features
              </a>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-6 rounded-[2.5rem] bg-accent/60 blur-2xl" />
            <div className="relative bg-card rounded-2xl shadow-soft-lg border border-border p-10 sm:p-14 flex items-center justify-center">
              <LogoHero className="w-full max-w-sm" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 bg-card/60 border-y border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-text-primary">
              Everything your rescue needs, in one place
            </h2>
            <p className="mt-4 text-lg text-text-secondary">
              Replace the patchwork of spreadsheets, paper records, and group
              texts with workflows built for how rescues actually operate.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group bg-card rounded-2xl border border-border shadow-soft p-7 transition-all duration-150 hover:shadow-soft-lg hover:-translate-y-0.5">
                  <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-secondary mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-heading font-bold text-lg text-text-primary mb-2">
                    {f.title}
                  </h3>
                  <p className="text-text-secondary leading-relaxed">{f.body}</p>
                </div>);

            })}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="relative overflow-hidden rounded-2xl bg-primary text-white px-8 py-14 sm:px-16 sm:py-20 shadow-soft-lg">
          <PawPrint
            aria-hidden="true"
            className="absolute -right-6 -bottom-6 w-48 h-48 text-white/10" />
          <div className="relative max-w-3xl">
            <h2 className="font-heading font-bold text-3xl sm:text-4xl">
              Our mission
            </h2>
            <p className="mt-6 text-lg sm:text-xl leading-relaxed text-white/90">
              Whiskerville exists to help animal rescue organizations spend less
              time managing spreadsheets and paperwork and more time helping
              animals find safe homes.
            </p>
            <p className="mt-4 text-white/80 leading-relaxed">
              By improving organization, communication, and record keeping, we
              hope to support rescues, fosters, volunteers, and adopters in their
              mission to save lives.
            </p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-24">
        <div className="bg-card rounded-2xl border border-border shadow-soft p-10 sm:p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-secondary mx-auto mb-6">
            <Mail className="w-7 h-7" />
          </div>
          <h2 className="font-heading font-bold text-3xl text-text-primary">
            Get in touch
          </h2>
          <p className="mt-4 text-lg text-text-secondary max-w-xl mx-auto">
            For questions, support requests, or partnership inquiries, we’d love
            to hear from you.
          </p>
          <a
            href="mailto:support@whiskerville.app"
            className={`${primaryCta} mt-8`}>
            <Mail className="w-5 h-5" />
            support@whiskerville.app
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col sm:flex-row gap-8 sm:items-center sm:justify-between">
            <Link to="/" className="flex items-center gap-2.5" aria-label="Whiskerville home">
              <LogoMark className="w-8 h-8" />
              <span className="font-heading font-bold text-text-primary">
                Whiskerville
              </span>
            </Link>
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
              <a href="#features" className="hover:text-text-primary transition-colors">
                Features
              </a>
              <a href="#contact" className="hover:text-text-primary transition-colors">
                Contact
              </a>
              <Link to="/privacy" className="hover:text-text-primary transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-text-primary transition-colors">
                Terms of Service
              </Link>
              <Link to="/login" className="font-medium text-primary hover:underline">
                Sign In
              </Link>
            </nav>
          </div>
          <p className="mt-8 text-sm text-text-secondary">
            © {year} Whiskerville. Helping rescues spend more time saving lives.
          </p>
        </div>
      </footer>
    </div>);

}
