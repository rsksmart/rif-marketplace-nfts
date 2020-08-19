const { expect } = require('chai');

const RNSSimplePlacementsV1 = artifacts.require('RNSSimplePlacementsV1');
const RNS = artifacts.require('RNS');
const NodeOwner = artifacts.require('NodeOwner');
const ResolverV1 = artifacts.require('ResolverV1');

const namehash = require('eth-ens-namehash').hash;
const { encodeCall } = require('@openzeppelin/upgrades');

const ProxyFactory = artifacts.require('ProxyFactory');
const ProxyAdmin = artifacts.require('ProxyAdmin');

const { shouldBehaveLikeSimplePlacement } = require('./behavior/simplePlacement.behavior');

contract('RNSSimplePlacementsV1', (accounts) => {
  const defaultTokenNode = namehash('defaulttoken.rsk');

  const getDefaultToken = () => web3.utils.sha3('defaulttoken');

  const getNotPlaced = () => web3.utils.sha3('notplaced');

  const setupToken = async (defaultToken) => {
    this.rns = await RNS.new();
    // Set NodeOwner
    this.nodeOwner = await NodeOwner.new(this.rns.address, namehash('rsk'));
    await this.rns.setSubnodeOwner('0x00', web3.utils.sha3('rsk'), this.nodeOwner.address);
    await this.nodeOwner.addRegistrar(accounts[0]);
    await this.nodeOwner.register(defaultToken, accounts[0], 365);

    // Set Resolver
    this.proxyFactory = await ProxyFactory.new();
    this.proxyAdmin = await ProxyAdmin.new();
    this.resolverV1 = await ResolverV1.new();
    const salt = '16';
    const data = encodeCall('initialize', ['address'], [this.rns.address]);
    await this.proxyFactory.deploy(salt,
      this.resolverV1.address,
      this.proxyAdmin.address,
      data);
    this.resolverAddress = await this.proxyFactory.getDeploymentAddress(salt, accounts[0]);
    this.proxy = await ResolverV1.at(this.resolverAddress);
    await this.rns.setResolver(defaultTokenNode, this.proxy.address);

    return this.nodeOwner;
  };

  const setupNotPlaced = async (notPlaced) => {
    await this.nodeOwner.register(notPlaced, accounts[0], 365);
    return this.nodeOwner;
  };

  const getInitializeEncodedCall = (token) => encodeCall('initialize', ['address', 'address', 'address', 'address'], [token.address, accounts[0], this.rns.address, this.proxy.address]);

  const afterChecks = async () => {
    expect(
      await this.rns.resolver(defaultTokenNode),
    ).to.be.eq(
      this.proxy.address,
    );

    expect(
      await this.proxy.addr(defaultTokenNode),
    ).to.be.eq(
      accounts[1],
    );

    expect(
      await this.rns.owner(defaultTokenNode),
    ).to.be.eq(
      accounts[1],
    );
  };

  shouldBehaveLikeSimplePlacement(
    RNSSimplePlacementsV1,
    getDefaultToken,
    setupToken,
    getInitializeEncodedCall,
    afterChecks,
    getNotPlaced,
    setupNotPlaced,
    accounts,
  );
});
