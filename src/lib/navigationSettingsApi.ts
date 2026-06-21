import { OrganizationNavigationSetting } from '../types';

/**
 * Supabase row → app OrganizationNavigationSetting
 * (organization_navigation_settings table, migration 0072). A missing row means
 * the tab is visible; only explicit toggles are persisted.
 */
export function rowToNavSetting(r: any): OrganizationNavigationSetting {
  return {
    tab_key: r.tab_key,
    is_visible: r.is_visible ?? true
  };
}

/** Upsert payload for a single tab's visibility (onConflict organization_id,tab_key). */
export function navSettingToUpsert(
  orgId: string,
  tabKey: string,
  isVisible: boolean
): Record<string, any> {
  return {
    organization_id: orgId,
    tab_key: tabKey,
    is_visible: isVisible
  };
}
