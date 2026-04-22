import { client } from './client';
import { Asset } from 'react-native-image-picker';

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

  createWithImage: async (data: CreateOfferData, photo: Asset) => {
    const createRes = await offersApi.create(data);
    const offerId = createRes.data?.offer_id;

    if (!offerId) {
      console.warn("Offer created, but no offer_id returned. Cannot upload image.");
      return createRes;
    }

    const formData = new FormData();
    formData.append('offer_id', offerId.toString());
    formData.append('file', {
      uri: photo.uri,
      type: photo.type || 'image/jpeg',
      name: photo.fileName || `offer-${offerId}.jpg`,
    } as any);

    const uploadRes = await client.post('/upload/offer-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return { ...createRes, upload_status: uploadRes };
  },

  // NEW: Fetches all active offers for the logged-in restaurant
  getMyOffers: (userId: number) => {
    return client.get(`/offers/my-offers?user_id=${userId}`);
  },

  // NEW: Soft-deletes (deactivates) an offer by its ID
  deleteOffer: (offerId: number, userId: number) => {
    return client.delete(`/offers/delete/${offerId}?user_id=${userId}`);
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