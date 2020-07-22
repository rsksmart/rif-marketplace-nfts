# RIF Marketplace

[![npm](https://img.shields.io/npm/v/@rsksmart/rif-marketplace-nfts)](https://www.npmjs.com/package/@rsksmart/rif-marketplace-nfts)
[![CircleCI](https://circleci.com/gh/rsksmart/rif-marketplace-nfts.svg?style=shield)](https://circleci.com/gh/rsksmart/rif-marketplace-nfts)

Smart Contracts designed to support the buying and selling of NFT tokens using multiple payment options. A specific implementation for **RNS domains** has been included to be used by the **RIF Marketplace** . 

**RIF Name Service (RNS)** enables the use of human readable names for blockchain addresses helping users to receive transactions in personalized domains. New RNS Domains can be obtained through the [RNS Manager]("https://manager.rns.rifos.org/").

This contract allows users to list an NFT token for a fixed price in multiple payment methods (ERC-20, ERC-677, ERC-777, and R-BTC). The contract acts as an  <b>escrow</b>, ensuring the NFT is released only when a <b>valid payment</b> is received, allowing the seller to keep control at all times.
  
## Usage 

```
npm i @rsksmart/rif-marketplace-nfts
```

## Run locally

Run tests:
```
npm test
```

Run test linter:
```
npm run lint
```

## Contracts

### ERC721 Simple Placements

Place an NFT for a fixed price.

- Receives payments in:
  - ERC-20
  - ERC-677
  - ERC-777
  - Gas

To place an NFT:
1. Execute `approve` in NFT giving approval to Simple Placements contract.
2. Execute `place` with the desired price and payment token. Use token payment 0x00 address for gas payments.

To buy a placed NFT:
- Get the price with `placement` method.
- Via ERC-20:
  1. Execute `approve` in token giving allowance of the price amount to Simple Placements.
  2. Execute `buy`.
- Via ERC-677:
  1. Execute `transferAndCall` with parameters:
    - `to`: Simple Placements contract.
    - `amount`: given by price -- leftover tokens are not returned
    - `data`: the token ID.
- Via ERC-777:
  1. Execute `send` with parameters:
    - `to`: Simple Placements contract.
    - `amount`: given by price -- leftover tokens are not returned
    - `data`: the token ID.
- Via gas:
  1. Execute `buy` method with transaction value paying for price.

To unplace an NFT:
- Remove approval the ERC-721 token.
- Execute `unplace` with the toke id.

Admin:
- Ownable contract. The owner can:
  - Set whitelisted tokens and their accepted methods with `setWhitelistedPaymentToken`
  - Change gas payment allowance with `allowGasPayments`
  - Set another owner with `transferOwnership`

### RNS Simple Placements

A specific implementation has been included for **RNS** which in addition to the basic features explained before it ensures to **clean up** the domain resolver and owner before transferring to the buyer.

## TypeScript typings

There are TypeScript typing definitions of the contracts published together with the original contracts.
Supported contract's libraries are:

* `web3` version 1.* - `web3-v1-contracts`
* `web3` version 2.* - `web3-v2-contracts`
* `truffle` - `truffle-contracts`
* `ethers` - `ethers-contracts`

## Troubleshot

- Problems installing `erc1820`:
  - Workaround 1:
    1. Remove it from `devDependencies`
    2. Run `npm i`
    3. Run `npm i --save-dev erc1820`
  - Workaround 2: use node `v10.16.0`
