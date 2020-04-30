# RIF Marketplace

[![npm](https://img.shields.io/npm/v/@rsksmart/rif-marketplace-nfts)](https://www.npmjs.com/package/@rsksmart/rif-marketplace-nfts)
[![CircleCI](https://circleci.com/gh/rsksmart/rif-marketplace-nfts.svg?style=shield)](https://circleci.com/gh/rsksmart/rif-marketplace-nfts)

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

### Simple Placements

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
