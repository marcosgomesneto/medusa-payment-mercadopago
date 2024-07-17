import {
  PaymentProcessorError,
  PaymentSessionStatus,
  PaymentStatus,
} from "@medusajs/medusa";
import { PaymentCreateRequest } from "mercadopago/dist/clients/payment/create/types";
import MercadopagoBase from "../core/mercadopago-base";
import { PaymentProviderKeys } from "../types";
import EventEmitter from "events";

class MercadopagoPixService extends MercadopagoBase {
  static identifier = PaymentProviderKeys.PIX;

  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    //When retrivePayment is called, this method is called to get the status of the payment

    return PaymentSessionStatus.AUTHORIZED;
  }

  async authorizePayment(
    paymentSessionData: Record<string, unknown>,
    context: { cart_id: string; action?: "webhook" }
  ): Promise<
    | PaymentProcessorError
    | { status: PaymentSessionStatus; data: Record<string, unknown> }
  > {
    const currentCart = await this.cartService.retrieve(context.cart_id, {
      relations: ["payment_sessions", "shipping_address"],
    });

    if (context.action === "webhook") {
      return {
        status: PaymentSessionStatus.AUTHORIZED,
        data: {
          ...paymentSessionData,
        },
      };
    }

    const requestData = this.generatePaymentFromCart(currentCart, {
      description: "PIX Payment",
      payment_method_id: "pix",
      payer: {
        identification: {
          number: currentCart.shipping_address?.metadata?.document as
            | string
            | undefined,
          type: "CPF",
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
        status: PaymentSessionStatus.AUTHORIZED,
        data: {
          ...paymentSessionData,
          id: processPayment.id,
          internalStatus: processPayment.status,
          qrCode:
            processPayment.point_of_interaction?.transaction_data?.qr_code,
          qrCodeBase64:
            processPayment.point_of_interaction?.transaction_data
              ?.qr_code_base64,
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

export default MercadopagoPixService;
