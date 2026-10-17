export function canManage(user: { id: string; role: string; active: boolean }, ownerId: string): boolean {
  return user.active && (user.role === 'ADMIN' || user.id === ownerId);
}
export function canChangeStructure(survey: { publishedAt: Date | string | null }): boolean {
  return survey.publishedAt === null;
}
