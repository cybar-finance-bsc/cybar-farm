# Cybar Farm

## Install Dependencies
`yarn`

## Compile Contracts
`yarn compile`

## Testnet Deployment

In the deployment script for a local deployment the Cybar Token is deployed alongside
three dummy LP token with the same supply of 35*10**6.

In order to test the smart contracts locally, first start your local ganache instance. Then
deploy the smart contracts by calling
```
yarn truffle migrate
```
