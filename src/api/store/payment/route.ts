import {
  MedusaRequest,
  MedusaResponse,
  OrderService,
  PaymentStatus,
} from "@medusajs/medusa";
import MercadopagoService from "../../../services/mercadopago";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const clientId = req.query.id as string | undefined;
  const orderId = req.query.order as string | undefined;
  if (!clientId || !orderId) {
    res.status(400).json({ message: "Missing id query parameter" });
    return;
  }
  const mercadopagoService =
    req.scope.resolve<MercadopagoService>("mercadopagoService");

  const orderService = req.scope.resolve<OrderService>("orderService");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const ping = setInterval(async () => {
    try {
      await orderService.capturePayment(orderId);
      const order = await orderService.retrieve(orderId, {
        relations: ["payments"],
      });
      res.write(
        `data: ${JSON.stringify({
          status: order.payment_status,
        })}\n\n`
      );
    } catch (e) {
      res.write(
        `data: ${JSON.stringify({
          status: "failed",
        })}\n\n`
      );
    }
  }, 10000);

  const emitter = mercadopagoService.createClientEmitter(clientId);

  emitter.on("status", (data: { status: PaymentStatus }) => {
    if (data.status === PaymentStatus.CAPTURED) {
      clearInterval(ping);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  });

  req.on("close", () => {
    clearInterval(ping);
    mercadopagoService.removeClientEmitter(clientId);
    res.end();
  });
};
