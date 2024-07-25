import {
  CartService,
  Logger,
  Order,
  OrderService,
  PaymentStatus,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/medusa";
import { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { EntityManager } from "typeorm";
import MercadopagoService from "../../../services/mercadopago";
import { MercadopagoWebhookRequest } from "../../../types";

export const POST = async (
  req: MedusaRequest<MercadopagoWebhookRequest>,
  res: MedusaResponse
) => {
  try {
    const mercadopagoService =
      req.scope.resolve<MercadopagoService>("mercadopagoService");

    const logger = req.scope.resolve<Logger>("logger");

    logger.info("Recived webhook from MercadoPago");
    logger.info(req.body);
    logger.info(req.headers);

    logger.info("Validate webhook signature");
    if (!mercadopagoService.validateSignature(req))
      throw new Error("Invalid webhook signature");

    logger.info("Validate: passed!");

    const event = req.body.action;

    const paymentData = await mercadopagoService.payment.get({
      id: req.body.data.id,
    });

    logger.info("Recived payment data: passed!");

    await processPayment(req, paymentData, event);

    res.json({
      success: true,
    });
  } catch (e) {
    res.json({
      message: e.message,
      success: false,
    });
  }
};

const processPayment = async (
  req: MedusaRequest,
  data: PaymentResponse,
  event: string
) => {
  const orderService = req.scope.resolve<OrderService>("orderService");
  const cartService = req.scope.resolve<CartService>("cartService");
  const mercadopagoService =
    req.scope.resolve<MercadopagoService>("mercadopagoService");
  const cartId = data.external_reference;

  if (!cartId) throw new Error("Cart id not found in payment data");

  const order: Order | undefined = await orderService
    .retrieveByCartId(cartId, {
      relations: ["payments"],
    })
    .catch(() => undefined);

  const manager = req.scope.resolve<EntityManager>("manager");

  await manager.transaction(async () => {
    switch (event) {
      case "payment.updated":
        if (!order) {
          await cartService.withTransaction(manager).authorizePayment(cartId, {
            action: "webhook",
          });
          const order = await orderService
            .withTransaction(manager)
            .createFromCart(cartId);
          if (order.payment_status !== PaymentStatus.CAPTURED) {
            await orderService
              .withTransaction(manager)
              .capturePayment(order.id);
            mercadopagoService.emitClientEvent(cartId, PaymentStatus.CAPTURED);
          }
        } else {
          if (order.payment_status !== PaymentStatus.CAPTURED) {
            await orderService
              .withTransaction(manager)
              .capturePayment(order.id);
            mercadopagoService.emitClientEvent(cartId, PaymentStatus.CAPTURED);
          }
        }

        break;
      case "payment.created":
        if (
          order &&
          order.payments[0].provider_id === "mercadopago-creditcard"
        ) {
          await orderService.withTransaction(manager).capturePayment(order.id);
          mercadopagoService.emitClientEvent(cartId, PaymentStatus.CAPTURED);
        }
        break;
      default:
        return;
    }
  });
};
