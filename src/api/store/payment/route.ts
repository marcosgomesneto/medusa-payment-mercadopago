import { MedusaRequest, MedusaResponse, PaymentStatus } from "@medusajs/medusa";
import MercadopagoService from "../../../services/mercadopago";


export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const clientId = req.query.id as string | undefined;
  if (!clientId) {
    res.status(400).json({ message: "Missing id query parameter" });
    return;
  }
  const mercadopagoService =
    req.scope.resolve<MercadopagoService>("mercadopagoService");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const ping = setInterval(() => {
    res.write(
      `data: ${JSON.stringify({
        status: "pending",
      })}\n\n`
    );
  }, 1000);

  const emitter = mercadopagoService.createClientEmitter(clientId);

  emitter.on("status", (data: { status: PaymentStatus }) => {
    console.log("2..2.emitting....", data);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  req.on("close", () => {
    console.log("end....");
    clearInterval(ping);
    mercadopagoService.removeClientEmitter(clientId);
    res.end();
  });
};
