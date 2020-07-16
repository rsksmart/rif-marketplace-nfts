const { constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const RNSSimplePlacementsV1 = artifacts.require('RNSSimplePlacementsV1');
const RNS = artifacts.require('RNS');
const NodeOwner = artifacts.require('NodeOwner');

const namehash = require('eth-ens-namehash').hash;
const { encodeCall } = require('@openzeppelin/upgrades');

const { shouldBehaveLikeSimplePlacement } = require('./behavior/simplePlacement.behavior');

contract('RNSSimplePlacementsV1', (accounts) => {
  const defaultTokenNode = namehash('defaulttoken.rsk');

  const getDefaultToken = () => web3.utils.sha3('defaulttoken');

  const getNotPlaced = () => web3.utils.sha3('notplaced');

  const setupToken = async (defaultToken) => {
    this.rns = await RNS.new();
    this.nodeOwner = await NodeOwner.new(this.rns.address, namehash('rsk'));
    await this.rns.setSubnodeOwner('0x00', web3.utils.sha3('rsk'), this.nodeOwner.address);
    await this.nodeOwner.addRegistrar(accounts[0]);
    await this.nodeOwner.register(defaultToken, accounts[0], 365);
    return this.nodeOwner;
  };

  const setupNotPlaced = async (notPlaced) => {
    await this.nodeOwner.register(notPlaced, accounts[0], 365);
    return this.nodeOwner;
  };

  const getInitializeEncodedCall = (token) => encodeCall('initialize', ['address', 'address', 'address'], [token.address, accounts[0], this.rns.address]);

  const afterChecks = async () => {
    expect(
      await this.rns.resolver(defaultTokenNode),
    ).to.be.eq(
      constants.ZERO_ADDRESS,
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
