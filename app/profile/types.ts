export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  avatarImageUrl?: string | null;
}

export interface OrderItemSummary {
  name: string;
  price: number;
  quantity: number;
  color?: string | null;
  size?: string | null;
}

export interface UserOrder {
  id: string;
  orderNumber: number;
  status: string;
  total: number;
  createdAt: Date;
  trackingCode?: string | null;
  items: OrderItemSummary[];
}
