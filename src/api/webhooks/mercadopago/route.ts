import type { MedusaRequest, MedusaResponse } from "@medusajs/medusa";
import crypto from "crypto";
import MercadopagoPaymentService from "../../../services/mercadopago-payment";

export const POST = (req: MedusaRequest, res: MedusaResponse) => {
  const mercadopagoPaymentService =
    req.scope.resolve<MercadopagoPaymentService>("mercadopagoPaymentService");

  if (validateSignature(req)) {
    mercadopagoPaymentService.webhook(req.body);
    res.json({
      success: true,
    });
  } else {
    res.json({
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
      { ts: undefined as string | undefined, hash: undefined as string | undefined }
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
