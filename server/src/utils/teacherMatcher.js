/**
 * Normalize a teacher name for matching across systems
 */
function normalizeName(name) {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Build a merged teacher list from online and offline teacher arrays.
 * Matches by normalized name.
 *
 * Returns: Map<normalizedName, { name, onlineId, offlineId, type }>
 */
export function mergeTeachers(onlineTeachers, offlineTeachers) {
  const merged = new Map();

  for (const t of onlineTeachers) {
    const key = normalizeName(t.name);
    merged.set(key, {
      name: t.name,
      onlineId: t.id,
      offlineId: null,
      type: 'online',
      onlineAvailability: t.availability || [],
      offlineAvailability: [],
    });
  }

  for (const t of offlineTeachers) {
    const key = normalizeName(t.name);
    if (merged.has(key)) {
      const existing = merged.get(key);
      existing.offlineId = t.id;
      existing.type = 'both';
      existing.offlineAvailability = t.availability || [];
    } else {
      merged.set(key, {
        name: t.name,
        onlineId: null,
        offlineId: t.id,
        type: 'offline',
        onlineAvailability: [],
        offlineAvailability: t.availability || [],
      });
    }
  }

  return merged;
}

/**
 * Find a teacher in the merged map by name (case-insensitive)
 */
export function findTeacher(mergedMap, name) {
  return mergedMap.get(normalizeName(name)) || null;
}
