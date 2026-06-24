// Maps a guidance message's `icon` name (a plain string stored in the DB) to a
// Lucide component. Unknown / missing names fall back to a neutral info glyph,
// so adding a new icon name in the DB never breaks rendering.
import {
  PawPrint,
  Home,
  Heart,
  Inbox,
  MapPin,
  Package,
  LayoutDashboard,
  Users,
  Stethoscope,
  Sparkles,
  Info } from
'lucide-react';
import type { LucideIcon } from 'lucide-react';

const REGISTRY: Record<string, LucideIcon> = {
  PawPrint,
  Home,
  Heart,
  Inbox,
  MapPin,
  Package,
  LayoutDashboard,
  Users,
  Stethoscope,
  Sparkles,
  Info
};

export function guidanceIcon(name?: string): LucideIcon {
  return (name && REGISTRY[name]) || Info;
}
