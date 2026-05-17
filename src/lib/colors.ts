export function getInitialsColor(key: string) {
  const colors = [
  { bg: '#DDEFE2', text: '#3E7B52' }, // sage
  { bg: '#DCEAF7', text: '#356A9A' }, // soft blue
  { bg: '#F3E4D7', text: '#B8632E' }, // terracotta
  { bg: '#F8E7C8', text: '#A36B00' }, // amber
  { bg: '#E8DEEC', text: '#6E4E80' }, // muted plum
  { bg: '#FCE4E0', text: '#B05A4A' }, // warm coral
  { bg: '#DDE7E5', text: '#2E6F68' }, // primary teal
  { bg: '#F0EBDE', text: '#7A6A4A' } // warm taupe
  ];

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}