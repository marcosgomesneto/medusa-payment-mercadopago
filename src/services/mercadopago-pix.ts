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

  async authorizePayment(
    paymentSessionData: Record<string, unknown>,
    context: { cart_id: string; action?: "webhook" }
  ): Promise<
    | PaymentProcessorError
    | { status: PaymentSessionStatus; data: Record<string, unknown> }
  > {
    console.log("Authorize Payment....", paymentSessionData, context);
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
      console.info("MecadoPago Request...", requestData);
      const processPayment = await this.mpService.payment.create({
        body: requestData,
        requestOptions: {
          idempotencyKey:
            currentCart.payment_session?.id ?? '' + requestData.transaction_amount,
        },
      });

      console.log("recebeu o requesst....", processPayment);

      return {
        status: PaymentSessionStatus.REQUIRES_MORE,
        data: {
          ...paymentSessionData,
          id: processPayment.id,
          internalStatus: processPayment.status,
          qrCode: processPayment.point_of_interaction?.transaction_data?.qr_code,
          qrCodeBase64:
            processPayment.point_of_interaction?.transaction_data?.qr_code_base64,
        },
      };
    } catch (e) {
      console.info("MecadoPagoErro", e);
      throw new Error("errr...");
    }
  }
}

export default MercadopagoPixService;
