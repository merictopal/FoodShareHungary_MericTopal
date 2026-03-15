import { client } from './client';
// Imported Asset to define the type of the selected photo
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

  // NEW: Function to handle offer creation with an image upload
  createWithImage: async (data: CreateOfferData, photo: Asset) => {
    // 1. Create the offer using the standard text-based endpoint first
    const createRes = await offersApi.create(data);
    
    // 🚀 FIXED: Added .data here! Axios wraps backend responses inside a 'data' object.
    const offerId = createRes.data?.offer_id;
    
    if (!offerId) {
      console.warn("Offer created, but no offer_id was returned. Cannot upload image.");
      return createRes;
    }

    // 3. Package the image into a FormData object for multipart/form-data upload
    const formData = new FormData();
    formData.append('offer_id', offerId.toString());
    formData.append('file', {
      uri: photo.uri,
      type: photo.type || 'image/jpeg',
      name: photo.fileName || `offer-${offerId}.jpg`,
    } as any);

    // 4. Send the image to the AWS S3 upload route
    const uploadRes = await client.post('/upload/offer-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return { ...createRes, upload_status: uploadRes };
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