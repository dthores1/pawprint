import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2Icon } from 'lucide-react';
import { LogoHero } from '../components/ui/Logo';
import { Input, Label, Select, Textarea } from '../components/ui/Forms';
import { Button } from '../components/ui/Button';
import {
  submitSignupRequest,
  ORGANIZATION_TYPES,
  ANIMAL_COUNT_RANGES } from
'../lib/signupRequestsApi';

// Public "Request Beta Access" page — reachable without a session (rendered
// outside the auth Gate; see App.tsx). Submissions land in
// public.organization_signup_requests and notify support@ via an edge function.
// Self-service org creation is disabled during the beta, so this is how
// prospective rescues ask to be onboarded.

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
      {children}
    </h2>);

}

export function RequestAccessPage() {
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('');
  const [city, setCity] = useState('');
  const [stateProv, setStateProv] = useState('');
  const [website, setWebsite] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [animalCount, setAnimalCount] = useState('');
  const [notes, setNotes] = useState('');
  // Honeypot: real humans never see or fill this. If it's set on submit we
  // pretend success and silently drop the submission.
  const [honeypot, setHoneypot] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot.trim() !== '') {
      // Bot: act like it worked, do nothing.
      setSubmitted(true);
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await submitSignupRequest({
      organization_name: orgName,
      organization_type: orgType,
      city,
      state: stateProv,
      website,
      contact_first_name: firstName,
      contact_last_name: lastName,
      contact_email: email,
      contact_phone: phone,
      animal_count_range: animalCount,
      notes
    });
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-center mb-8">
          <Link to="/" aria-label="Whiskerville home">
            <LogoHero className="w-40" />
          </Link>
        </div>

        <div className="bg-card rounded-2xl shadow-soft-lg border border-border p-8 sm:p-10">
          {submitted ?
          <div className="text-center py-6">
              <CheckCircle2Icon className="w-12 h-12 text-[#3E7B52] mx-auto mb-4" />
              <h1 className="text-2xl font-heading font-bold text-text-primary mb-3">
                Thanks for your interest in Whiskerville!
              </h1>
              <p className="text-text-secondary leading-relaxed mb-2">
                We've received your request and will reach out if we're accepting
                additional organizations into the beta.
              </p>
              <p className="text-text-secondary leading-relaxed mb-6">
                In the meantime, feel free to continue exploring{' '}
                <Link to="/" className="font-medium text-primary hover:underline">
                  whiskerville.app
                </Link>
                .
              </p>
              <Link to="/">
                <Button variant="outline">Back to home</Button>
              </Link>
            </div> :

          <>
              <h1 className="text-2xl font-heading font-bold text-text-primary mb-1">
                Request Beta Access
              </h1>
              <p className="text-sm text-text-secondary mb-8">
                Tell us about your rescue and we'll be in touch about joining the
                Whiskerville beta. Fields marked * are required.
              </p>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Organization Information */}
                <div>
                  <SectionHeading>Organization Information</SectionHeading>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="org_name">Organization name *</Label>
                      <Input
                      id="org_name"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      required />

                    </div>
                    <div>
                      <Label htmlFor="org_type">Organization type *</Label>
                      <Select
                      id="org_type"
                      value={orgType}
                      onChange={(e) => setOrgType(e.target.value)}
                      required>

                        <option value="" disabled>
                          Select a type…
                        </option>
                        {ORGANIZATION_TYPES.map((t) =>
                      <option key={t} value={t}>
                            {t}
                          </option>
                      )}
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="org_city">City *</Label>
                        <Input
                        id="org_city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        required />

                      </div>
                      <div>
                        <Label htmlFor="org_state">State / Province *</Label>
                        <Input
                        id="org_state"
                        value={stateProv}
                        onChange={(e) => setStateProv(e.target.value)}
                        required />

                      </div>
                    </div>
                    <div>
                      <Label htmlFor="org_website">Organization website</Label>
                      <Input
                      id="org_website"
                      type="url"
                      inputMode="url"
                      placeholder="https://"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)} />

                    </div>
                  </div>
                </div>

                {/* Primary Contact */}
                <div>
                  <SectionHeading>Primary Contact</SectionHeading>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="c_first">First name *</Label>
                        <Input
                        id="c_first"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required />

                      </div>
                      <div>
                        <Label htmlFor="c_last">Last name *</Label>
                        <Input
                        id="c_last"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required />

                      </div>
                    </div>
                    <div>
                      <Label htmlFor="c_email">Email address *</Label>
                      <Input
                      id="c_email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required />

                    </div>
                    <div>
                      <Label htmlFor="c_phone">Phone number</Label>
                      <Input
                      id="c_phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)} />

                    </div>
                  </div>
                </div>

                {/* About Your Organization */}
                <div>
                  <SectionHeading>About Your Organization</SectionHeading>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="animal_count">
                        Approximately how many animals do you care for at one
                        time?
                      </Label>
                      <Select
                      id="animal_count"
                      value={animalCount}
                      onChange={(e) => setAnimalCount(e.target.value)}>

                        <option value="">Select a range…</option>
                        {ANIMAL_COUNT_RANGES.map((r) =>
                      <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                      )}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="notes">
                        What are you hoping to use Whiskerville for?
                      </Label>
                      <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Tell us a little about your rescue and what you're looking for." />

                    </div>
                  </div>
                </div>

                {/* Honeypot — visually hidden, off-screen, out of tab order. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor="website_url_confirm">
                    Leave this field blank
                  </label>
                  <input
                  id="website_url_confirm"
                  name="website_url_confirm"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)} />

                </div>

                {error &&
                <p className="text-sm text-[#9B3A3A]">{error}</p>
                }

                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? 'Submitting…' : 'Request Beta Access'}
                </Button>
              </form>
            </>
          }
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            ← Back to Whiskerville
          </Link>
        </div>
      </div>
    </div>);

}
