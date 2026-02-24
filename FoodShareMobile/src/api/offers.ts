import { client } from './client';

// --- INTERFACES ---
export interface CreateOfferData {
  user_id: number;      
  title: string;        
  description: string; 
  type: 'free' | 'discount';
  quantity: number;
  discount_rate: number;
}

export interface ClaimOfferData {
  user_id: number;
  offer_id: number;
}

// --- API ROUTES ---
export const offersApi = {
  
  // ==========================================
  // RESTAURANT ROUTES
  // ==========================================

  create: async (data: CreateOfferData) => {
    const payload = {
      ...data,
      quantity: Number(data.quantity),
      discount_rate: Number(data.discount_rate)
    };
    return client.post('/offers/create', payload);
  },

  verifyQr: (qrCode: string) => {
    return client.post('/claims/verify', { qr_code: qrCode }); 
  },

  // ==========================================
  // STUDENT ROUTES
  // ==========================================

  getAll: (userId: number, lat: number, lng: number) => {
    const params = new URLSearchParams({
      user_id: userId.toString(),
      lat: lat.toString(),
      lng: lng.toString(),
    });
    return client.get(`/offers?${params.toString()}`);
  },

  claim: (data: ClaimOfferData) => {
    return client.post('/offers/claim', data);
  },

  getHistory: (userId: number) => {
    return client.get(`/student/history/${userId}`);
  }
};