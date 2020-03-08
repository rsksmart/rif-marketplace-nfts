# RIF Marketplace

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

- Receives ERC-20 payments

To place an NFT:
1. Execute `approve` in NFT giving approval to Simple Placements contract.
2. Execute `place` with the desired price.

To buy a placed NFT:
- Get the price with `placement` method.
- Via ERC-20:
  1. Execute `approve` in token giving allowance of the price amount to Simple Placements.
  2. Execute `buy`.
    
To unplace an NFT:
- Execute `approve` in NFT giving approval to 0 address.
- Exectute `unplace`.

> Notice: NFTs are automatically unplaced after purchase

> Notice: if NFT is transferred or disapproved, purchising will fail.
> Anyone can execute `unplace` for any token that is not approved to
> Simple Placements.

### Simple Placements with ERC-677

Same features as [Simple Placements](#Simple-Placements) +

- Receives ERC-677 payments

To buy a placed NFT:
- Via ERC-721:
  1. Eecute `transferAndCall` with parameters:
    - `to`: Simple Placements contract.
    - `amount`: given by price -- leftover tokens are not returned
    - `data`: the token ID.
