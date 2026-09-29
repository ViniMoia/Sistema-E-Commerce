export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  cpfCnpj?: string | null;
  role: string;
  avatarImageUrl?: string | null;
}

export type { OrderItemSummary, UserOrder } from '@/types/order.types';
