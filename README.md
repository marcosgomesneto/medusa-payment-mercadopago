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

---

## How to Install

1\. Run the following command in the directory of the Medusa backend:

```bash
npm install @marcosgomesneto/medusa-payment-mercadopago
```

2\. Set the following environment variables in `.env`:

```bash
MERCADOPAGO_ACCESS_TOKEN=APP_USR...
MERCADOPAGO_WEBHOOK_URL=http....
# only necessary for production
MERCADOPAGO_WEBHOOK_SECRET=5573326353c523ebbc84af5ad376b860ad5225339d05535c804974b2393d0f30
```

3\. In `medusa-config.js` add the following at the end of the `plugins` array:

```js
const plugins = [
  // ...
  {
    resolve: `@marcosgomesneto/medusa-payment-mercadopago`,
    options: {
      access_token: process.env.MERCADOPAGO_ACCESS_TOKEN,
      webhook_url: process.env.MERCADOPAGO_WEBHOOK_URL,
      webhook_secret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
    },
  },
];
```

---

## Test the Plugin

1\. Run the following command in the directory of the Medusa backend to run the backend:

```bash
npm run start
```

2\. Enable Mercadopago in a region in the admin. You can refer to [this User Guide](https://docs.medusajs.com/user-guide/regions/providers) to learn how to do that. Alternatively, you can use the [Admin APIs](https://docs.medusajs.com/api/admin#tag/Region/operation/PostRegionsRegion).

3\. Place an order using a storefront or the [Store APIs](https://docs.medusajs.com/api/store). You should be able to use Mercadopago as a payment method.

---

