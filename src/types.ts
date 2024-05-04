export interface MercadopagoOptions extends Record<string, unknown> {
  accessToken: string;
  webhookSecret?: string;
  webhookUrl: string;
}

export enum PaymentProviderKeys {
  CREDIT_CARD = "mercadopago-creditcard",
  PIX = "mercadopago-pix",
}
