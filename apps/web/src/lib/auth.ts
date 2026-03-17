export type UserRole = 'superadmin' | 'admin' | 'asistente';

export type MeResponse = {
  ok: true;
  user: { id: string; email: string; name: string | null; role: UserRole; businessId: string | null };
};

