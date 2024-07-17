<p align="center">
  <img src="https://github.com/marcosgomesneto/marcosgomesneto/blob/main/images/mercadopago-medusajs.png?raw=true"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@marcosgn/medusa-payment-mercadopago"><img src="https://badgen.net/npm/v/@marcosgn/medusa-payment-mercadopago" alt="npm package"></a>
</p>

# Mercado Pago Transparent Checkout for MedusaJS

Receive payments on your Medusa commerce application using Mercadopago Transparent Checkout.

## Features

- Authorize payments with **Credit Card** using Transparent Checkout.
- Authorize payments with **PIX (Brazilian)** using Transparent Checkout.
- Support Webhooks
- Webhook security validation

---

## Prerequisites

- [Medusa backend](https://docs.medusajs.com/development/backend/install)
- [Mercadopago account](https://mercadopago.com/)

## Contribute with:

- ⭐ Starred this repository
- [Follow me](https://github.com/marcosgomesneto) in github
- Report [Inssues](https://github.com/marcosgomesneto/medusa-payment-mercadopago/issues)

---

## How to Install

1\. Run the following command in the directory of the Medusa backend:

```bash
#Using npm
npm install @marcosgn/medusa-payment-mercadopago

#Using yarn
yarn add @marcosgn/medusa-payment-mercadopago
```

2\. Set the following environment variables in `.env`:

```bash
MERCADOPAGO_ACCESS_TOKEN=APP_USR...
MERCADOPAGO_WEBHOOK_URL=https://<your-domain>/webhooks/mercadopago

# Optional, but recommended in production
MERCADOPAGO_WEBHOOK_SECRET=5573326353c523ebbc84af5ad376b860ad5225339d05535c804974b2393d0f30
```

Generate your token here: [Mercadopago developers](https://www.mercadopago.com.br/developers/panel/app)

3\. In `medusa-config.js` add the following at the end of the `plugins` array:

```js
const plugins = [
  // ...
  {
    resolve: `@marcosgn/medusa-payment-mercadopago`,
    options: {
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
      webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
      webhookUrl: process.env.MERCADOPAGO_WEBHOOK_URL,
    },
  },
];
```

---

## Test the Plugin

1\. Run the following command in the directory of the Medusa backend to run the backend:

```bash
#Using npm
npm run dev

#Using
yarn dev
```

2\. Enable Mercadopago Credit Card or/and Pix in a region in the admin panel. You can refer to [this User Guide](https://docs.medusajs.com/user-guide/regions/providers) to learn how to do that. Alternatively, you can use the [Admin APIs](https://docs.medusajs.com/api/admin#tag/Region/operation/PostRegionsRegion).

3\. Place an order using a storefront or the [Store APIs](https://docs.medusajs.com/api/store). You should be able to use Mercadopago as a payment method.

## Storefront Usage

Transparent checkout documentation for storefront [Mercadopago Docs](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing)

### Credit Card Payment

```typescript
const client = useMedusaClient();

//Set provider
await client.carts.setPaymentSession(cartId, {
  provider_id: "mercadopago-creditcard",
});

//Update required props in payment session
await client.carts.updatePaymentSession(cartId, paymentProviderId, {
  data: {
    token: "...", //Credit Card Token
    installment: "1",
    cpfCnpj: "000000000000",
    holderName: "John Doe",
    identificationType: "CPF",
    issuerId: "...",
    paymentMethodId: "master",
  },
});

//Complete and capture payment
const response = await client.carts.complete(cartId);
```

### Pix Payment

```typescript
const client = useMedusaClient();

await client.carts.setPaymentSession(cartId, {
  provider_id: "mercadopago-pix",
});

//Complete and recive PIX Qrcode
const response = await client.carts.complete(cartId);

//Copy and Paste Code
const copyPasteCode = response.data.payment_session.data.qrCode;
//QRCode image in base64 format
const base64Image = response.data.payment_session.data.qrCodeBase64;
```

---
