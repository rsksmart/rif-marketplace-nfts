const ERC721Mintable = artifacts.require('ERC721Mintable');
const ProxyFactory = artifacts.require('ProxyFactory');
const ProxyAdmin = artifacts.require('ProxyAdmin');
const ERC721SimplePlacementsV1 = artifacts.require('ERC721SimplePlacementsV1');

const assert = require('assert');

const { encodeCall } = require('@openzeppelin/upgrades');

//const RMKT_TESTNET_MULTI_SIG = '0x0';
//const RMKT_MULTI_SIG = '0x0';

module.exports = (deployer, network, accounts) => {
  if(network !== 'test') {
    deployer.then(async () => {
      if (network === 'develop') {
        const nft = await deployer.deploy(ERC721Mintable);
        this.tokenAddress = nft.address;
      } else if (network === 'testnet') {
        this.tokenAddress = '0xca0a477e19bac7e0e172ccfd2e3c28a7200bdb71';
      } 

      let proxyFactory
      if (network === 'develop') {
        proxyFactory = await deployer.deploy(ProxyFactory);
      } else if (network === 'testnet') {
        proxyFactory = await ProxyFactory.at('0xbb71c17b28baf2b9e7f5b31660ecf758113b3fef');
      }

      const proxyAdmin = await deployer.deploy(ProxyAdmin);
      const simplePlacementsV1 = await deployer.deploy(ERC721SimplePlacementsV1);

      const salt = '16';
      const data = encodeCall('initialize', ['address'], [this.tokenAddress]);
      await proxyFactory.deploy(salt, simplePlacementsV1.address, proxyAdmin.address, data);

      /*if (network === 'testnet') {
        await proxyAdmin.transferOwnership(RMKT_TESTNET_MULTI_SIG);
      } else if (network === 'mainnet') {
        await proxyAdmin.transferOwnership(RMKT_MULTI_SIG);
      }*/

      const deploymentAddress = await proxyFactory.getDeploymentAddress(salt, accounts[0]);
      const implementationAddress = await proxyAdmin.getProxyImplementation(deploymentAddress);

      assert.equal(implementationAddress, simplePlacementsV1.address);

      const owner = await proxyAdmin.owner().then(r => r.toLowerCase());

      /*if (network === 'testnet') {
        assert.equal(owner, RMKT_TESTNET_MULTI_SIG);
      } else if (network === 'mainnet') {
        assert.equal(owner, RMKT_MULTI_SIG);
      }*/

      console.log('Proxy factory: ' + proxyFactory.address);
      console.log('Proxy admin: ' + proxyAdmin.address);
      console.log('NFTS Contract implementation: ' + simplePlacementsV1.address);
      console.log('-------------');
      console.log('Resulting proxy deployment address: ' + deploymentAddress);
      console.log('Resulting querying implementation address: ' + implementationAddress);
    });
  }
};