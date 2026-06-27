// Standardized confirmation copy for cancelling a coordination request, shared
// across Transports, Sitting, and Supplies so the wording stays consistent.
// `thing` is the human noun, e.g. 'transport request' / 'supply request'.
export function cancelRequestConfirm(thing: string) {
  return {
    title: `Cancel ${thing}?`,
    body: `Are you sure you want to cancel this ${thing}?`,
    confirmLabel: 'Cancel Request',
    cancelLabel: 'Keep Request',
    tone: 'danger' as const
  };
}
