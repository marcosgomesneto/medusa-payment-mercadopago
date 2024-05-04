import {
  CartService,
  Order,
  OrderService,
  PaymentStatus,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/medusa";
import { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { EntityManager } from "typeorm";
import MercadopagoService from "../../../services/mercadopago";
import MercadopagoPixService from "../../../services/mercadopago-pix";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const mercadopagoService =
      req.scope.resolve<MercadopagoService>("mercadopagoService");

    if (!mercadopagoService.validateSignature(req))
      throw new Error("Invalid webhook signature");

    const event = req.body.action;

    const paymentData = await mercadopagoService.payment.get({
      id: req.body.data.id,
    });

    console.log("Webhook received", paymentData, event);

    if (paymentData.payment_method_id === "pix")
      await processPixPayment(req, res, paymentData, event);

    res.json({
      success: true,
    });
  } catch (e) {
    console.log("Error processing webhook", e.message);
    res.json({
      message: e.message,
      success: false,
    });
  }
};

const processPixPayment = async (
  req: MedusaRequest,
  res: MedusaResponse,
  data: PaymentResponse,
  event: string
) => {
  console.log("Processing pix payment....");
  const mercadopagoPixService = req.scope.resolve<MercadopagoPixService>(
    "mercadopagoPixService"
  );
  const orderService = req.scope.resolve<OrderService>("orderService");
  const cartService = req.scope.resolve<CartService>("cartService");
  const mercadopagoService =
    req.scope.resolve<MercadopagoService>("mercadopagoService");
  const cartId = data.external_reference;

  if (!cartId) throw new Error("Cart id not found in payment data");

  const order: Order | undefined = await orderService
    .retrieveByCartId(cartId)
    .catch(() => undefined);

  const manager = req.scope.resolve<EntityManager>("manager");

  await manager.transaction(async () => {
    switch (event) {
      case "payment.updated":
        console.log("Payment updated....");
        if (!order) {
          console.log("Authorize cart....");
          await cartService.withTransaction(manager).authorizePayment(cartId, {
            action: "webhook",
          });
          console.log("Creating order from cart....");
          const order = await orderService
            .withTransaction(manager)
            .createFromCart(cartId);
          console.log("Capturing payment....", order.payment_status);
          if (order.payment_status !== PaymentStatus.CAPTURED) {
            console.log("Capturing payment 2....");
            await orderService
              .withTransaction(manager)
              .capturePayment(order.id);
            console.log("Emiting....");
            mercadopagoService.emitClientEvent(cartId, PaymentStatus.CAPTURED);
          }
        }

        break;
      default:
        return;
    }
  });
};
