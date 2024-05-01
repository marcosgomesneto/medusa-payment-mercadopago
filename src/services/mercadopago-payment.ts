import {
  CartService,
  AbstractPaymentProcessor,
  PaymentProcessorContext,
  PaymentProcessorError,
  PaymentProcessorSessionResponse,
  PaymentSessionStatus,
  isPaymentProcessorError,
  OrderService,
} from "@medusajs/medusa";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { PaymentCreateRequest } from "mercadopago/dist/clients/payment/create/types";
import { EntityManager } from "typeorm";

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

interface RetrivePayment extends PaymentResponse, Record<string, unknown> { }

class MercadopagoPaymentService extends AbstractPaymentProcessor {
  protected cartService: CartService;
  protected orderService: OrderService;
  protected manager: EntityManager;
  static identifier = "mercadopago-payment";
  private client: MercadoPagoConfig;
  private payment: Payment;

  constructor({ cartService, orderService, manager }) {
    super({ cartService, orderService, manager });

    this.cartService = cartService;
    this.orderService = orderService;
    this.manager = manager;

    this.client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
      options: { timeout: 5000 },
    });
    this.payment = new Payment(this.client);

    console.info("MercadoPagoPaymentService constructor");
  }

  capturePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    console.log("Captureeeee payment....");
    throw new Error("Method not implemented 6.");
  }
  async authorizePayment(
    paymentSessionData: MercadoPagoPaymentFormData,
    context: { cart_id: string; id?: number; status?: string }
  ): Promise<
    | PaymentProcessorError
    | { status: PaymentSessionStatus; data: Record<string, unknown> }
  > {
    const currentCart = await this.cartService.retrieve(context.cart_id, {
      relations: ["payment_sessions", "shipping_address"],
    });

    const isPix = paymentSessionData.paymentMethodId === "pix";

    console.info("Authorize Context", context, context.id, isPix);

    if (context.id && isPix && context.status) {
      return {
        status: this.getStatus(context.status),
        data: {
          ...paymentSessionData,
          id: paymentSessionData.id,
          internalStatus: "approved",
        },
      };
    }

    console.info("Authorize Payment?..", paymentSessionData, currentCart);

    const requestData: PaymentCreateRequest = {
      ...(!isPix && {
        token: paymentSessionData.token,
        installments: Number(paymentSessionData.installment),
        issuer_id: Number(paymentSessionData.issuerId),
      }),
      external_reference: currentCart.id,
      transaction_amount: Number(currentCart.payment_session?.amount) / 100,
      description: `Compra na Crown Caffè`,
      payment_method_id: paymentSessionData.paymentMethodId,
      ...(process.env.MERCADOPAGO_WEBHOOK_URL && {
        notification_url: process.env.MERCADOPAGO_WEBHOOK_URL,
      }),
      payer: {
        email: currentCart.email,
        first_name: currentCart.shipping_address?.first_name ?? undefined,
        last_name: currentCart.shipping_address?.last_name ?? undefined,
        phone: {
          number: currentCart.shipping_address?.phone ?? undefined,
        },
        identification: {
          number: paymentSessionData.cpfCnpj.replace(/\D/g, ""),
          type: paymentSessionData.identificationType,
        },
        address: {
          city: currentCart.shipping_address?.city ?? undefined,
          zip_code: currentCart.shipping_address?.postal_code ?? undefined,
          street_name: currentCart.shipping_address?.address_1 ?? undefined,
        },
      },
    };

    try {
      console.info("MecadoPago Request", requestData);
      const processPayment = await this.payment.create({
        body: requestData,
        requestOptions: {
          idempotencyKey:
            currentCart.payment_session!.id + requestData.transaction_amount,
        },
      });

      console.info("MecadoPago Response", processPayment);
      return {
        status: this.getStatus(processPayment.status!),
        data: {
          ...paymentSessionData,
          id: processPayment.id,
          internalStatus: processPayment.status,
          ...(isPix && {
            qrCode:
              processPayment.point_of_interaction?.transaction_data?.qr_code,
            qrCodeBase64:
              processPayment.point_of_interaction?.transaction_data?.qr_code_base64,
          }),
        },
      };
    } catch (e) {
      console.info("MecadoPagoErro", e);
      throw new Error("errr...");
    }
  }
  cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented 1.");
  }
  async initiatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | PaymentProcessorSessionResponse> {
    //when user select payment method with setPaymentSession in store front
    return {
      session_data: {},
    };
  }
  deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented 2.");
  }
  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    console.log("Get payment status function....", paymentSessionData);
    switch (paymentSessionData.status) {
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
  refundPayment(
    paymentSessionData: Record<string, unknown>,
    refundAmount: number
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented 4.");
  }
  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<RetrivePayment | PaymentProcessorError> {
    try {
      //Called automatically by authorizePayment when status is authorized
      console.log("Retrive Payment with session...", paymentSessionData);
      const paymentResponse = await this.payment.get({
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
  async updatePayment(
    context: PaymentProcessorContext
  ): Promise<void | PaymentProcessorError | PaymentProcessorSessionResponse> {
    return {
      session_data: {},
    };
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

  async webhook(body: any) {
    console.log("Webhook recived...");
    const paymentData = await this.retrievePayment(body.data);
    if (isPaymentProcessorError(paymentData))
      throw new Error(paymentData.error);

    const cartId = paymentData.external_reference;

    if (!cartId) throw new Error("No external reference");

    const status = this.getStatus(paymentData.status!);

    if (status === PaymentSessionStatus.AUTHORIZED) {
      this.manager.transaction(async (manager) => {
        // await this.cartService
        //   .withTransaction(manager)
        //   .setPaymentSession(cartId, this.getIdentifier());

        console.log(
          "setting payment session2...",
          cartId,
          this.getIdentifier()
        );

        const order = await this.orderService
          .withTransaction(manager)
          .retrieveByCartId(cartId)
          .catch((_) => undefined);

        if (!order) {
          await this.cartService
            .withTransaction(manager)
            .authorizePayment(paymentData.external_reference!, {
              id: paymentData.id,
              status: paymentData.status,
            });
          await this.orderService
            .withTransaction(manager)
            .createFromCart(cartId);
        }
      });
    }

    console.log("Product retrivied...", paymentData);
  }

  getStatus(status: string): PaymentSessionStatus {
    //Convert status from MercadoPago to Medusa status
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
  // methods here...
}

export default MercadopagoPaymentService;
