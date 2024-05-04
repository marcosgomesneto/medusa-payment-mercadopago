import {
  MedusaRequest,
  PaymentStatus,
  TransactionBaseService,
} from "@medusajs/medusa";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { Lifetime } from "awilix";
import EventEmitter from "events";
import { MercadopagoOptions } from "../types";
import crypto from "crypto";

class MercadopagoService extends TransactionBaseService {
  static LIFE_TIME = Lifetime.SINGLETON;

  protected readonly options: MercadopagoOptions;
  protected client: MercadoPagoConfig;
  public payment: Payment;
  private clientEmitters: { [key: string]: EventEmitter } = {};

  constructor(container: any, options: MercadopagoOptions) {
    console.log("Contructino....................");
    super(container, options);
    this.options = options;
    console.log("options", options);
    console.log("New instance for mercadopago.........");
    this.client = new MercadoPagoConfig({
      accessToken: options.accessToken,
      options: { timeout: 5000 },
    });
    this.payment = new Payment(this.client);
  }

  validateSignature = (req: MedusaRequest): boolean => {
    try {
      if (!this.options.webhookSecret) return true;

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
      const secret = this.options.webhookSecret;
      const manifest = `id:${dataID};request-id:${xRequestId};ts:${ts};`;
      const hmac = crypto.createHmac("sha256", secret);

      hmac.update(manifest);

      const sha = hmac.digest("hex");

      return sha === hash;
    } catch (e) {
      return false;
    }
  };

  createClientEmitter(clientId: string) {
    const emitter = new EventEmitter();
    this.clientEmitters[clientId] = emitter;
    return emitter;
  }

  emitClientEvent(clientId: string, status: PaymentStatus) {
    console.log("Emiting client event....", clientId, status);
    if (this.clientEmitters[clientId]) {
      console.log("Emiting client event w....");
      this.clientEmitters[clientId].emit("status", {
        status,
      });
    }
  }

  removeClientEmitter(clientId: string) {
    if (this.clientEmitters[clientId]) {
      this.clientEmitters[clientId].removeAllListeners();
      delete this.clientEmitters[clientId];
    }
  }
}

export default MercadopagoService;
