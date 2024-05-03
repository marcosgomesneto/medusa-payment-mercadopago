import {
  CartService,
  Order,
  OrderService,
  PaymentStatus,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/medusa";
import crypto from "crypto";
import { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { EntityManager } from "typeorm";
import MercadopagoService from "../../../services/mercadopago";
import MercadopagoPixService from "../../../services/mercadopago-pix";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const valid = validateSignature(req);
    if (!valid) throw new Error("Invalid signature");

    const mercadopagoService =
      req.scope.resolve<MercadopagoService>("mercadopagoService");

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

const validateSignature = (req: MedusaRequest) => {
  try {
    //if no secret is set, we allow all requests
    if (process.env.MERCADOPAGO_WEBHOOK_SECRET === undefined) return true;

    const xSignature = req.headers["x-signature"] as string;
    const xRequestId = req.headers["x-request-id"];
    const dataID = req.body.data?.id;
    const parts = xSignature.split(",");

    const result = parts.reduce(
      (acc, part) => {
        const [key, value] = part.split("=").map((str) => str.trim());
        if (key === "ts") {
          acc.ts = value;
        } else if (key === "v1") {
          acc.hash = value;
        }
        return acc;
      },
      { ts: undefined, hash: undefined } as { ts?: string; hash?: string }
    );

    const { ts, hash } = result;
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const manifest = `id:${dataID};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto.createHmac("sha256", secret);

    hmac.update(manifest);

    const sha = hmac.digest("hex");

    return sha === hash;
  } catch (e) {
    return false;
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
