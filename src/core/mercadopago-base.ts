import {
  AbstractPaymentProcessor,
  Cart,
  CartService,
  PaymentProcessorContext,
  PaymentProcessorError,
  PaymentProcessorSessionResponse,
  PaymentSessionStatus,
  isPaymentProcessorError,
} from "@medusajs/medusa";
import { PaymentCreateRequest } from "mercadopago/dist/clients/payment/create/types";
import { deepMerge } from "./utils";
import { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import MercadopagoService from "../services/mercadopago";
import { MercadopagoOptions } from "../types";

interface RetrivePayment extends PaymentResponse, Record<string, unknown> {}

abstract class MercadopagoBase extends AbstractPaymentProcessor {
  static identifier = "";

  protected readonly options: MercadopagoOptions;
  protected mpService: MercadopagoService;
  protected cartService: CartService;

  protected constructor(container: any, options: MercadopagoOptions) {
    super(container, options);
    this.options = options;
    this.cartService = container.cartService;
    this.mpService = container.mercadopagoService;
  }

  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    //When retrivePayment is called, this method is called to get the status of the payment

    const id = paymentSessionData.id as number;

    const paymentIntent = await this.mpService.payment.get({
      id: id,
    });

    if (!paymentIntent.status) return PaymentSessionStatus.ERROR;

    return this.getStatus(paymentIntent.status);
  }

  async initiatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | PaymentProcessorSessionResponse> {
    //when user select payment method with setPaymentSession in store front, Here you can even give a cart discount depending on the method
    return {
      session_data: {},
    };
  }

  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<RetrivePayment | PaymentProcessorError> {
    try {
      //Called automatically by authorizePayment when status is authorized
      const paymentResponse = await this.mpService.payment.get({
        id: paymentSessionData.id as string,
      });
      return {
        ...paymentResponse,
      };
    } catch (error) {
      return {
        error: error,
      };
    }
  }

  async updatePaymentData(
    sessionId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    //when user select payment method with updatePaymentSession in store front
    return {
      ...(data.paymentMethodId !== "pix" && {
        token: data.token,
        installment: data.installment,
        holderName: data.holderName,
        issuerId: data.issuerId,
      }),
      cpfCnpj: data.cpfCnpj,
      identificationType: data.identificationType,
      paymentMethodId: data.paymentMethodId,
    };
  }

  async updatePayment(
    context: PaymentProcessorContext
  ): Promise<void | PaymentProcessorError | PaymentProcessorSessionResponse> {
    return {
      session_data: {},
    };
  }

  cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented 1.");
  }

  deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented 2.");
  }

  refundPayment(
    paymentSessionData: Record<string, unknown>,
    refundAmount: number
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented 4.");
  }

  getStatus(status: string | undefined): PaymentSessionStatus {
    switch (status) {
      case "approved":
      case "authorized":
        return PaymentSessionStatus.AUTHORIZED;
      case "refunded":
      case "charged_back":
      case "cancelled":
        return PaymentSessionStatus.CANCELED;
      case "rejected":
        return PaymentSessionStatus.ERROR;
      case "pending":
      case "in_process":
      case "in_mediation":
        return PaymentSessionStatus.PENDING;
      default:
        return PaymentSessionStatus.PENDING;
    }
  }

  generatePaymentFromCart(
    cart: Cart,
    replace: Partial<PaymentCreateRequest>
  ): PaymentCreateRequest {
    return deepMerge<PaymentCreateRequest>(
      {
        external_reference: cart.id,
        transaction_amount: cart.payment_session
          ? Number(cart.payment_session.amount) / 100
          : 0,

        notification_url: this.options.webhookUrl,
        payer: {
          email: cart.email,
          first_name: cart.shipping_address?.first_name ?? "",
          last_name: cart.shipping_address?.last_name ?? "",
          phone: {
            number: cart.shipping_address?.phone ?? "",
          },
          address: {
            city: cart.shipping_address?.city ?? "",
            zip_code: cart.shipping_address?.postal_code ?? "",
            street_name: cart.shipping_address?.address_1 ?? "",
          },
        },
      },
      replace
    );
  }

  async capturePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    const id = paymentSessionData.id as number;

    const paymentIntent = await this.mpService.payment.get({
      id: id,
    });

    if (!paymentIntent.status) throw new Error("Payment not found");

    const status = this.getStatus(paymentIntent.status);

    if (status !== PaymentSessionStatus.AUTHORIZED)
      throw new Error("Payment not authorized");

    return {
      ...paymentSessionData,
    };
  }
}

export default MercadopagoBase;
