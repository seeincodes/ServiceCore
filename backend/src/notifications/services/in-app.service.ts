import db from '../../shared/database/connection';

export async function createNotification(params: {
  orgId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
}): Promise<void> {
  await db('notifications').insert({
    org_id: params.orgId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    data: params.data ? JSON.stringify(params.data) : null,
  });
}
