import { client } from './client';

// Mirrors backend GET /api/notifications (Notification.to_dict)
export interface NotificationDTO {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  date: string;
}

export const notificationsApi = {
  // The backend returns only the authenticated user's notifications (identity from the JWT), newest first
  getMine: async (): Promise<NotificationDTO[]> => {
    const res = await client.get('/notifications');
    return res.data?.notifications || [];
  },

  markAllRead: () => client.post('/notifications/read'),
};
