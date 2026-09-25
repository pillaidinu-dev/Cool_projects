export const SUBJECTS = [
  { key: 'homework', label: 'Homework', emoji: '📚', color: '#5B8DEF' },
  { key: 'chores', label: 'Chores', emoji: '🧹', color: '#4CAF7D' },
  { key: 'sports', label: 'Sports', emoji: '⚽', color: '#FF9F45' },
  { key: 'reading', label: 'Reading', emoji: '📖', color: '#9B6BE0' },
  { key: 'family', label: 'Family', emoji: '👨‍👩‍👧', color: '#F5C94A' },
  { key: 'fun', label: 'Fun', emoji: '🎉', color: '#F26B8A' },
  { key: 'other', label: 'Other', emoji: '⭐', color: '#8C97A8' },
];

export function getSubject(key) {
  return SUBJECTS.find((s) => s.key === key) || SUBJECTS[SUBJECTS.length - 1];
}
