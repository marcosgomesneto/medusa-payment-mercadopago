import { PaymentProcessorError, PaymentSessionStatus } from "@medusajs/medusa";
import MercadopagoBase from "../core/mercadopago-base";
import { PaymentProviderKeys } from "../types";

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
        },
      };
    } catch (e) {
      throw new Error(e.message);
    }
  }

  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    return {};
  }
}

export default MercadopagoCreditcardService;
