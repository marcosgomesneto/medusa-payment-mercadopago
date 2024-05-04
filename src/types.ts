export interface MercadopagoOptions extends Record<string, unknown> {
  accessToken: string;
  webhookSecret?: string;
  webhookUrl: string;
}

export interface MercadopagoWebhookRequest {
  action: "payment.created" | "payment.updated" | "payment.refunded";
  api_version: "v1";
  data: {
    id: string;
  };
  date_created: string;
  id: number;
  live_mode: boolean;
  type: "payment";
  user_id: string;
}

export enum PaymentProviderKeys {
  CREDIT_CARD = "mercadopago-creditcard",
  PIX = "mercadopago-pix",
}
