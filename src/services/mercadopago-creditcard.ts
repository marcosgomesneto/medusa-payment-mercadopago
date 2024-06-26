import {
  PaymentProcessorError,
  PaymentSessionStatus,
  OrderService,
} from "@medusajs/medusa";
import MercadopagoBase from "../core/mercadopago-base";
import { EntityManager } from "typeorm";
import { MercadopagoOptions, PaymentProviderKeys } from "../types";

interface MercadoPagoPaymentFormData extends Record<string, unknown> {
  id?: number;
  token: string;
  installment: number;
  cpfCnpj: string;
  holderName: string;
  identificationType: string;
  issuerId: number;
  paymentMethodId: string;
}

class MercadopagoCreditcardService extends MercadopagoBase {
  static identifier = PaymentProviderKeys.CREDIT_CARD;

  protected orderService: OrderService;
  protected manager: EntityManager;

  constructor({ orderService, manager }, options: MercadopagoOptions) {
    super({ orderService, manager }, options);

    this.orderService = orderService;
    this.manager = manager;
  }

  async authorizePayment(
    paymentSessionData: MercadoPagoPaymentFormData,
    context: { cart_id: string }
  ): Promise<
    | PaymentProcessorError
    | { status: PaymentSessionStatus; data: Record<string, unknown> }
  > {
    const currentCart = await this.cartService.retrieve(context.cart_id, {
      relations: ["payment_sessions", "shipping_address"],
    });

    const isPix = paymentSessionData.paymentMethodId === "pix";

    const requestData = this.generatePaymentFromCart(currentCart, {
      token: paymentSessionData.token,
      installments: Number(paymentSessionData.installment),
      issuer_id: Number(paymentSessionData.issuerId),
      description: "CreditCard Payment",
      payer: {
        identification: {
          number: paymentSessionData.cpfCnpj.replace(/\D/g, ""),
          type: paymentSessionData.identificationType,
        },
      },
    });

    try {
      const processPayment = await this.mpService.payment.create({
        body: requestData,
        requestOptions: {
          idempotencyKey:
            currentCart.payment_session?.id ??
            "" + requestData.transaction_amount,
        },
      });

      return {
        status: this.getStatus(processPayment.status),
        data: {
          ...paymentSessionData,
          id: processPayment.id,
          internalStatus: processPayment.status,
          ...(isPix && {
            qrCode:
              processPayment.point_of_interaction?.transaction_data?.qr_code,
            qrCodeBase64:
              processPayment.point_of_interaction?.transaction_data
                ?.qr_code_base64,
          }),
        },
      };
    } catch (e) {
      throw new Error("errr...");
    }
  }
}

export default MercadopagoCreditcardService;
