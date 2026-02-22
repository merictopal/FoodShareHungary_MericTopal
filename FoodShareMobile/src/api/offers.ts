import { client } from './client';


interface CreateOfferData {
  user_id: number;      
  title: string;        
  description: string; 
  type: 'free' | 'discount';
  quantity: number;
  discount_rate: number;
}

interface ClaimOfferData {
  user_id: number;
  offer_id: number;
}


export const offersApi = {
  

  create: async (data: CreateOfferData) => {
    const payload = {
      ...data,
      quantity: Number(data.quantity),
      discount_rate: Number(data.discount_rate)
    };
    return client.post('/offers/create', payload);
  },


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
  },


  verifyQr: (qrCode: string) => {
    return client.post('/offers/claim', { qr_code: qrCode });
  }
};