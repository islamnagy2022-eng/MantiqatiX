export type IdentifiedPerson = { id: string };

export function findVisiblePerson<T extends IdentifiedPerson>(
  selectedId: string,
  people: readonly T[],
): T | null {
  if (!selectedId) return null;
  return people.find((person) => person.id === selectedId) ?? null;
}

export function resolveVisiblePersonId(
  currentId: string,
  people: readonly IdentifiedPerson[],
): string {
  return findVisiblePerson(currentId, people)?.id ?? people[0]?.id ?? '';
}
