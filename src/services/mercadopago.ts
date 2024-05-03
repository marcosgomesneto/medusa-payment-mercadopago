import { PaymentStatus, TransactionBaseService } from "@medusajs/medusa";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { Lifetime } from "awilix";
import EventEmitter from "events";

class MercadopagoService {
  static LIFE_TIME = Lifetime.SINGLETON;
  protected client: MercadoPagoConfig;
  public payment: Payment;
  private clientEmitters: { [key: string]: EventEmitter } = {};

  constructor() {
    console.log("New instance for mercadopago...........");
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
      options: { timeout: 5000 },
    });
    this.payment = new Payment(this.client);
  }

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
