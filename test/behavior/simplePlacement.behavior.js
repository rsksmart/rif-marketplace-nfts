const { constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const BytesLib = artifacts.require('BytesLib');
const ERC1820 = require('erc1820');

const ERC20 = artifacts.require('ERC20Mintable');
const ERC677 = artifacts.require('ERC677');
const ERC777 = artifacts.require('ERC777Mintable');

const { encodeCall } = require('@openzeppelin/upgrades');

const ProxyFactory = artifacts.require('ProxyFactory');
const ProxyAdmin = artifacts.require('ProxyAdmin');

const DummyVersion = artifacts.require('DummyVersion');

function shouldBehaveLikeSimplePlacement(
  SimplePlacementContract,
  getDefaultToken,
  setupToken,
  getInitializeEncodedCall,
  afterChecks,
  getNotPlaced,
  setupNotPlaced,
  accounts,
) {
  const defaultToken = getDefaultToken();

  beforeEach(async () => {
    this.token = await setupToken(defaultToken);

    await ERC1820.deploy(web3, accounts[0]);

    this.erc20 = await ERC20.new();
    await this.erc20.mint(accounts[1], web3.utils.toBN('1000000000000000000000'));

    this.erc677 = await ERC677.new(
      accounts[1],
      web3.utils.toBN('1000000000000000000000'),
      'RIF',
      'RIF',
      web3.utils.toBN('18'),
    );

    this.erc777 = await ERC777.new('ERC 721', '721', []);
    await this.erc777.mint(accounts[1], web3.utils.toBN('1000000000000000000000'));

    const bytesLib = await BytesLib.new();
    await SimplePlacementContract.link('BytesLib', bytesLib.address);

    this.proxyFactory = await ProxyFactory.new();
    this.proxyAdmin = await ProxyAdmin.new();
    this.simplePlacementsV1 = await SimplePlacementContract.new();

    const salt = '20';
    const data = getInitializeEncodedCall(this.token);
    await this.proxyFactory.deploy(salt,
      this.simplePlacementsV1.address,
      this.proxyAdmin.address,
      data);

    this.simplePlacementsAddress = await this.proxyFactory.getDeploymentAddress(salt, accounts[0]);
    this.proxy = await SimplePlacementContract.at(this.simplePlacementsAddress);
  });

  describe('upgrades', async () => {
    it('should use given implementation', async () => {
      const implAddr = await this.proxyAdmin.getProxyImplementation(this.simplePlacementsAddress);

      expect(implAddr).to.eq(this.simplePlacementsV1.address);
    });

    it('should not allow not owner to upgrade', async () => {
      const dummyVersion = await DummyVersion.new();

      const data = encodeCall('initialize', ['address', 'uint'], [this.token.address, 10]);
      await expectRevert.unspecified(
        this.proxyAdmin.upgradeAndCall(
          this.simplePlacementsAddress,
          dummyVersion.address,
          data,
          { from: accounts[1] },
        ),
      );

      const implAddr = await this.proxyAdmin.getProxyImplementation(this.simplePlacementsAddress);

      expect(implAddr).to.eq(this.simplePlacementsV1.address);
    });

    it('should allow owner to upgrade', async () => {
      await this.proxy.methods['allowGasPayments(bool)'](false, { from: accounts[0] });

      const dummyVersion = await DummyVersion.new();

      await this.proxyAdmin.upgradeAndCall(this.simplePlacementsAddress, dummyVersion.address, encodeCall('initialize', [], []));

      const implAddr = await this.proxyAdmin.getProxyImplementation(this.simplePlacementsAddress);
      expect(implAddr).to.eq(dummyVersion.address);

      const proxy = await DummyVersion.at(this.simplePlacementsAddress);

      const newValue = web3.utils.toBN('10');
      await proxy.setValue(newValue);
      const value = await proxy.value();
      expect(value).to.be.bignumber.eq(newValue);

      expect(await proxy.isGasPaymentAllowed()).to.eq(false);
    });
  });

  describe('initialize', async () => {
    it('should store token address', async () => {
      const nftToken = await this.proxy.token();

      expect(nftToken).to.eq(this.token.address);
    });
  });

  describe('ownership', async () => {
    it('creator should be the owner', async () => {
      const owner = await this.proxy.owner();

      expect(
        owner,
      ).to.eq(
        accounts[0],
      );
    });

    it('should not allow not owner to set new owner', async () => {
      await expectRevert(
        this.proxy.transferOwnership(accounts[1], { from: accounts[1] }),
        'Ownable: caller is not the owner',
      );
    });

    it('should allow owner to set new owner', async () => {
      await this.proxy.transferOwnership(accounts[1]);

      const owner = await this.proxy.owner();

      expect(
        owner,
      ).to.eq(
        accounts[1],
      );
    });
  });

  describe('whitelisting', async () => {
    it('should not allow not owner to set whitelisted token', async () => {
      const token = await ERC20.new({ from: accounts[1] });

      await expectRevert(
        this.proxy.setWhitelistedPaymentToken(
          token.address, true, false, false, { from: accounts[1] },
        ),
        'Ownable: caller is not the owner',
      );

      const whitelisted = await this.proxy.whitelistedPaymentToken(token.address);

      expect(whitelisted[0]).to.eq(false);
      expect(whitelisted[1]).to.eq(false);
      expect(whitelisted[2]).to.eq(false);
    });

    it('should not allow not owner to allow gas payments', async () => {
      await expectRevert(
        this.proxy.allowGasPayments(true, { from: accounts[1] }),
        'Ownable: caller is not the owner',
      );

      // eslint-disable-next-line no-unused-expressions
      expect(await this.proxy.isGasPaymentAllowed()).to.be.false;
    });

    it('should allow owner to set whitelisted token', async () => {
      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, true, true, false,
      );

      const whitelisted = await this.proxy.whitelistedPaymentToken(this.erc677.address);

      expect(whitelisted[0]).to.eq(true);
      expect(whitelisted[1]).to.eq(true);
      expect(whitelisted[2]).to.eq(false);
    });

    it('should only allow to allow gas payments', async () => {
      await this.proxy.allowGasPayments(true);

      // eslint-disable-next-line no-unused-expressions
      expect(await this.proxy.isGasPaymentAllowed()).to.be.true;
    });

    it('should allow owner to remove whitelisted tokens', async () => {
      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, true, true, false,
      );

      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, false, false, false,
      );

      const whitelisted = await this.proxy.whitelistedPaymentToken(this.erc677.address);

      expect(whitelisted[0]).to.eq(false);
      expect(whitelisted[1]).to.eq(false);
      expect(whitelisted[2]).to.eq(false);
    });

    it('should allow owner to remove approval for gas payments', async () => {
      await this.proxy.allowGasPayments(true);

      await this.proxy.allowGasPayments(false);

      // eslint-disable-next-line no-unused-expressions
      expect(await this.proxy.isGasPaymentAllowed()).to.be.false;
    });

    it('should emit PaymentTokenWhitelisted event', async () => {
      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, true, true, false,
      );

      const logs = await this.proxy.getPastEvents('allEvents');

      await expectEvent.inLogs(
        logs,
        'PaymentTokenWhitelistChanged',
        {
          paymentToken: this.erc677.address,
          isERC20: true,
          isERC677: true,
          isERC777: false,
        },
      );
    });
  });

  describe('placing', async () => {
    const cost = web3.utils.toBN('1000000000000000000');

    it('should revert when there is no placement for a token', async () => {
      const notPlaced = getNotPlaced();

      await expectRevert(
        this.proxy.placement(notPlaced),
        'Token not placed.',
      );
    });

    it('should not allow to place token with not whitelisted payment token', async () => {
      await this.token.approve(this.proxy.address, defaultToken);

      await expectRevert(
        this.proxy.place(defaultToken, this.erc677.address, cost),
        'Payment token not allowed.',
      );
    });

    it('should not allow to place token for gas if it is not allowed', async () => {
      await this.token.approve(this.proxy.address, defaultToken);

      await expectRevert(
        this.proxy.place(defaultToken, constants.ZERO_ADDRESS, cost),
        'Payment token not allowed.',
      );
    });

    it('should not allow to place not approved token', async () => {
      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await expectRevert(
        this.proxy.place(defaultToken, this.erc677.address, cost),
        'Not approved to transfer.',
      );

      await expectRevert(
        this.proxy.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should not allow not owner or controller to place token', async () => {
      await this.token.approve(this.proxy.address, defaultToken);

      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await expectRevert(
        this.proxy.place(defaultToken, this.erc677.address, cost, { from: accounts[3] }),
        'Not approved or owner.',
      );

      await expectRevert(
        this.proxy.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should not allow to place with zero cost', async () => {
      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await this.token.approve(this.proxy.address, defaultToken);

      await expectRevert(
        this.proxy.place(defaultToken, this.erc677.address, 0),
        'Cost should be greater than zero.',
      );

      await expectRevert(
        this.proxy.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should allow owner to place token', async () => {
      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await this.token.approve(this.proxy.address, defaultToken);

      await this.proxy.place(defaultToken, this.erc677.address, cost);

      const placement = await this.proxy.placement(defaultToken);

      expect(placement[0]).to.eq(this.erc677.address);
      expect(placement[1]).to.be.bignumber.equal(cost);
    });

    it('should allow controller to place token', async () => {
      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await this.token.approve(this.proxy.address, defaultToken);

      await this.token.setApprovalForAll(accounts[2], true);

      await this.proxy.place(
        defaultToken, this.erc677.address, cost, { from: accounts[2] },
      );

      const placement = await this.proxy.placement(defaultToken);

      expect(placement[0]).to.eq(this.erc677.address);
      expect(placement[1]).to.be.bignumber.equal(cost);
    });

    it('should emit TokenPlaced event', async () => {
      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await this.token.approve(this.proxy.address, defaultToken);

      await this.token.setApprovalForAll(accounts[2], true);

      const receipt = await this.proxy.place(
        defaultToken, this.erc677.address, cost, { from: accounts[2] },
      );

      await expectEvent(
        receipt,
        'TokenPlaced',
        {
          tokenId: web3.utils.toBN(defaultToken),
          paymentToken: this.erc677.address,
          cost,
        },
      );
    });

    it('should not allow to place if contract is paused', async () => {
      await this.proxy.pause();

      await this.token.approve(this.proxy.address, defaultToken);

      await expectRevert(
        this.proxy.place(defaultToken, this.erc677.address, 0),
        'Pausable: paused -- Reason given: Pausable: paused.',
      );

      await expectRevert(
        this.proxy.placement(defaultToken),
        'Token not placed.',
      );
    });
  });

  describe('unplacing', async () => {
    const cost = web3.utils.toBN('1000000000000000000');

    beforeEach(async () => {
      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );
    });

    it('should allow anyone to unplace not approved tokens', async () => {
      await this.token.approve(this.proxy.address, defaultToken);

      await this.proxy.place(defaultToken, this.erc677.address, cost);

      await this.token.approve(constants.ZERO_ADDRESS, defaultToken);

      await this.proxy.unplace(defaultToken);

      await expectRevert(
        this.proxy.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should allow anyone to unplace transferred tokens', async () => {
      await this.token.approve(this.proxy.address, defaultToken);

      await this.proxy.place(defaultToken, this.erc677.address, cost);

      await this.token.transferFrom(accounts[0], accounts[2], defaultToken);

      await this.proxy.unplace(defaultToken);

      await expectRevert(
        this.proxy.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should emit TokenUnplaced event', async () => {
      await this.token.approve(this.proxy.address, defaultToken);

      await this.proxy.place(defaultToken, this.erc677.address, cost);

      await this.token.approve(constants.ZERO_ADDRESS, defaultToken);

      const receipt = await this.proxy.unplace(defaultToken);

      await expectEvent(
        receipt,
        'TokenUnplaced',
        {
          tokenId: web3.utils.toBN(defaultToken),
        },
      );
    });
  });

  describe('buying', async () => {
    describe('should require specific whitelisting for purchase execution', async () => {
      const cost = web3.utils.toBN('1000000000000000000');

      beforeEach(async () => {
        await this.token.approve(this.proxy.address, defaultToken);
      });

      it('erc20 approve + buy', async () => {
        await this.proxy.setWhitelistedPaymentToken(
          this.erc20.address, false, true, false,
        );

        await this.proxy.place(defaultToken, this.erc20.address, cost);

        await this.erc20.approve(this.proxy.address, cost, { from: accounts[1] });

        await expectRevert(
          this.proxy.buy(defaultToken, { from: accounts[1] }),
          'Wrong purchase method.',
        );
      });

      it('erc677 transferAndCall', async () => {
        await this.proxy.setWhitelistedPaymentToken(
          this.erc677.address, true, false, false,
        );

        await this.proxy.place(defaultToken, this.erc677.address, cost);

        await expectRevert(
          this.erc677.transferAndCall(
            this.proxy.address,
            cost,
            defaultToken,
            { from: accounts[1] },
          ),
          'Wrong purchase method.',
        );
      });

      it('erc777 send', async () => {
        await this.proxy.setWhitelistedPaymentToken(
          this.erc777.address, true, false, false,
        );

        await this.proxy.place(defaultToken, this.erc777.address, cost);

        await expectRevert(
          this.erc777.send(
            this.proxy.address,
            cost,
            defaultToken,
            { from: accounts[1] },
          ),
          'Wrong purchase method.',
        );
      });

      it('gas', async () => {
        await this.proxy.allowGasPayments(true);

        await this.proxy.place(defaultToken, constants.ZERO_ADDRESS, cost);

        await this.proxy.allowGasPayments(false);

        await expectRevert(
          this.proxy.buy(defaultToken, { from: accounts[1], value: cost }),
          'Wrong purchase method.',
        );
      });

      describe('erc20 + erc677', async () => {
        beforeEach(async () => {
          await this.proxy.setWhitelistedPaymentToken(
            this.erc677.address, false, false, true,
          );
        });

        it('approve + buy', async () => {
          await this.proxy.place(defaultToken, this.erc677.address, cost);

          await this.erc677.approve(this.proxy.address, cost, { from: accounts[1] });

          await expectRevert(
            this.proxy.buy(defaultToken, { from: accounts[1] }),
            'Wrong purchase method.',
          );
        });

        it('transferAndCall', async () => {
          await this.proxy.place(defaultToken, this.erc677.address, cost);

          await expectRevert(
            this.erc677.transferAndCall(
              this.proxy.address,
              cost,
              defaultToken,
              { from: accounts[1] },
            ),
            'Wrong purchase method.',
          );
        });
      });

      describe('erc20 + erc777', async () => {
        beforeEach(async () => {
          await this.proxy.setWhitelistedPaymentToken(
            this.erc777.address, false, true, false,
          );
        });

        it('approve + buy', async () => {
          await this.proxy.place(defaultToken, this.erc777.address, cost);

          await this.erc777.approve(this.proxy.address, cost, { from: accounts[1] });

          await expectRevert(
            this.proxy.buy(defaultToken, { from: accounts[1] }),
            'Wrong purchase method.',
          );
        });

        it('send', async () => {
          await this.proxy.place(defaultToken, this.erc777.address, cost);

          await expectRevert(
            this.erc777.send(
              this.proxy.address,
              cost,
              defaultToken,
              { from: accounts[1] },
            ),
            'Wrong purchase method.',
          );
        });
      });
    });

    describe('should not allow to buy not placed token via', async () => {
      const notPlaced = getNotPlaced();
      const cost = web3.utils.toBN('1000000000000000000');

      beforeEach(async () => {
        await setupNotPlaced(notPlaced);
      });

      it('erc20 approve + buy', async () => {
        await this.proxy.setWhitelistedPaymentToken(
          this.erc20.address, true, false, false,
        );

        await this.erc20.approve(this.proxy.address, cost, { from: accounts[1] });

        await expectRevert(
          this.proxy.buy(notPlaced, { from: accounts[1] }),
          'Token not placed.',
        );
      });

      it('erc677 transferAndCall', async () => {
        await this.proxy.setWhitelistedPaymentToken(
          this.erc677.address, false, true, false,
        );

        await expectRevert(
          this.erc677.transferAndCall(
            this.proxy.address, cost, notPlaced, { from: accounts[1] },
          ),
          'Token not placed.',
        );
      });

      it('erc777 send', async () => {
        await this.proxy.setWhitelistedPaymentToken(
          this.erc777.address, false, false, true,
        );

        await expectRevert(
          this.erc777.send(this.proxy.address, cost, notPlaced, { from: accounts[1] }),
          'Token not placed.',
        );
      });

      it('gas', async () => {
        await this.proxy.allowGasPayments(true);

        await expectRevert(
          this.erc777.send(this.proxy.address, cost, notPlaced, { from: accounts[1] }),
          'Token not placed.',
        );
      });

      describe('erc20 + erc677', async () => {
        beforeEach(async () => {
          await this.proxy.setWhitelistedPaymentToken(
            this.erc677.address, true, true, false,
          );
        });

        it('approve + buy', async () => {
          await this.erc677.approve(this.proxy.address, cost, { from: accounts[1] });

          await expectRevert(
            this.proxy.buy(notPlaced, { from: accounts[1] }),
            'Token not placed.',
          );
        });

        it('transferAndCall', async () => {
          await expectRevert(
            this.erc677.transferAndCall(
              this.proxy.address, cost, notPlaced, { from: accounts[1] },
            ),
            'Token not placed.',
          );
        });
      });

      describe('erc20 + erc777', async () => {
        beforeEach(async () => {
          await this.proxy.setWhitelistedPaymentToken(
            this.erc777.address, false, true, true,
          );
        });

        it('erc20 approve + transfer', async () => {
          await this.erc777.approve(this.proxy.address, cost, { from: accounts[1] });

          await expectRevert(
            this.proxy.buy(notPlaced, { from: accounts[1] }),
            'Token not placed.',
          );
        });

        it('erc777 send', async () => {
          await expectRevert(
            this.erc777.send(this.proxy.address, cost, notPlaced, { from: accounts[1] }),
            'Token not placed.',
          );
        });
      });
    });

    describe(
      'should transfer placed token when are sent via + emit PlacementUpdated to 0 + remove placement',
      async () => {
        const cost = web3.utils.toBN('1000000000000000000');

        beforeEach(async () => {
          await this.token.approve(this.proxy.address, defaultToken);
        });

        it('erc20 approve + buy', async () => {
          await this.proxy.setWhitelistedPaymentToken(
            this.erc20.address, true, false, false,
          );

          await this.proxy.place(defaultToken, this.erc20.address, cost);

          await this.erc20.approve(this.proxy.address, cost, { from: accounts[1] });

          await this.proxy.buy(defaultToken, { from: accounts[1] });
        });

        it('erc677 transferAndCall', async () => {
          await this.proxy.setWhitelistedPaymentToken(
            this.erc677.address, false, true, false,
          );

          await this.proxy.place(defaultToken, this.erc677.address, cost);

          await this.erc677.transferAndCall(
            this.proxy.address,
            cost,
            defaultToken,
            { from: accounts[1] },
          );
        });

        it('erc777 send', async () => {
          await this.proxy.setWhitelistedPaymentToken(
            this.erc777.address, false, false, true,
          );

          await this.proxy.place(defaultToken, this.erc777.address, cost);

          await this.erc777.send(
            this.proxy.address,
            cost,
            defaultToken,
            { from: accounts[1] },
          );
        });

        it('gas', async () => {
          await this.proxy.allowGasPayments(true);

          await this.proxy.place(defaultToken, constants.ZERO_ADDRESS, cost);

          await this.proxy.buy(defaultToken, { from: accounts[1], value: cost });
        });

        describe('erc20 + erc677', async () => {
          beforeEach(async () => {
            await this.proxy.setWhitelistedPaymentToken(
              this.erc677.address, true, true, false,
            );
          });

          it('erc20 approve + buy', async () => {
            await this.proxy.place(defaultToken, this.erc677.address, cost);

            await this.erc677.approve(this.proxy.address, cost, { from: accounts[1] });

            await this.proxy.buy(defaultToken, { from: accounts[1] });
          });

          it('erc677 transferAndCall', async () => {
            await this.proxy.place(defaultToken, this.erc677.address, cost);

            await this.erc677.transferAndCall(
              this.proxy.address,
              cost,
              defaultToken,
              { from: accounts[1] },
            );
          });
        });

        describe('erc20 + erc777', async () => {
          beforeEach(async () => {
            await this.proxy.setWhitelistedPaymentToken(
              this.erc777.address, true, false, true,
            );
          });

          it('erc20 approve + buy', async () => {
            await this.proxy.place(defaultToken, this.erc777.address, cost);

            await this.erc777.approve(this.proxy.address, cost, { from: accounts[1] });

            await this.proxy.buy(defaultToken, { from: accounts[1] });
          });

          it('erc777 send', async () => {
            await this.proxy.place(defaultToken, this.erc777.address, cost);

            await this.erc777.send(
              this.proxy.address,
              cost,
              defaultToken,
              { from: accounts[1] },
            );
          });
        });

        afterEach(async () => {
          expect(
            await this.token.ownerOf(defaultToken),
          ).to.be.eq(
            accounts[1],
          );

          await expectEvent.inLogs(
            await this.proxy.getPastEvents('allEvents'),
            'TokenSold',
            {
              tokenId: web3.utils.toBN(defaultToken),
              newOwner: accounts[1],
            },
          );

          await expectRevert(
            this.proxy.placement(defaultToken),
            'Token not placed.',
          );

          await afterChecks();
        });
      },
    );

    describe('should not transfer placed token when not enough are sent via', async () => {
      const cost = web3.utils.toBN('2000000000000000000');

      beforeEach(async () => {
        await this.token.approve(this.proxy.address, defaultToken);
      });

      it('erc20 approve + buy', async () => {
        await this.proxy.setWhitelistedPaymentToken(
          this.erc20.address, true, false, false,
        );

        await this.proxy.place(defaultToken, this.erc20.address, cost);

        await this.erc677.approve(this.proxy.address, web3.utils.toBN('1000000000000000000'), { from: accounts[1] });

        await expectRevert(
          this.proxy.buy(defaultToken, { from: accounts[1] }),
          'ERC20: transfer amount exceeds allowance -- Reason given: ERC20: transfer amount exceeds allowance.',
        );
      });

      it('erc677 transferAndCall', async () => {
        await this.proxy.setWhitelistedPaymentToken(
          this.erc677.address, false, true, false,
        );

        await this.proxy.place(defaultToken, this.erc677.address, cost);

        await expectRevert(
          this.erc677.transferAndCall(this.proxy.address, web3.utils.toBN('1000000000000000000'), defaultToken, { from: accounts[1] }),
          'Transfer amount is not correct.',
        );
      });

      it('erc777 send', async () => {
        await this.proxy.setWhitelistedPaymentToken(
          this.erc777.address, false, false, true,
        );

        await this.proxy.place(defaultToken, this.erc777.address, cost);

        await expectRevert(
          this.erc777.send(this.proxy.address, web3.utils.toBN('1000000000000000000'), defaultToken, { from: accounts[1] }),
          'Transfer amount is not correct.',
        );
      });

      it('gas', async () => {
        await this.proxy.allowGasPayments(true);

        await this.proxy.place(defaultToken, constants.ZERO_ADDRESS, cost);

        await expectRevert(
          this.proxy.buy(defaultToken, { from: accounts[1], value: web3.utils.toBN('1000000000000000000') }),
          'Transfer amount is not correct.',
        );
      });

      describe('erc20 + erc677', async () => {
        beforeEach(async () => {
          await this.proxy.setWhitelistedPaymentToken(
            this.erc677.address, true, true, false,
          );
        });

        it('erc20 approve + buy', async () => {
          await this.proxy.place(defaultToken, this.erc677.address, cost);

          await this.erc677.approve(this.proxy.address, web3.utils.toBN('1000000000000000000'), { from: accounts[1] });

          await expectRevert(
            this.proxy.buy(defaultToken, { from: accounts[1] }),
            'ERC20: transfer amount exceeds allowance -- Reason given: ERC20: transfer amount exceeds allowance.',
          );
        });

        it('erc677 transferAndCall', async () => {
          await this.proxy.place(defaultToken, this.erc677.address, cost);

          await expectRevert(
            this.erc677.transferAndCall(this.proxy.address, web3.utils.toBN('1000000000000000000'), defaultToken, { from: accounts[1] }),
            'Transfer amount is not correct.',
          );
        });
      });

      describe('erc20 + erc777', async () => {
        beforeEach(async () => {
          await this.proxy.setWhitelistedPaymentToken(
            this.erc777.address, true, false, true,
          );
        });

        it('erc20 approve + buy', async () => {
          await this.proxy.place(defaultToken, this.erc777.address, cost);

          await this.erc777.approve(this.proxy.address, web3.utils.toBN('1000000000000000000'), { from: accounts[1] });

          await expectRevert(
            this.proxy.buy(defaultToken, { from: accounts[1] }),
            'ERC777: transfer amount exceeds allowance -- Reason given: ERC777: transfer amount exceeds allowance.',
          );
        });

        it('erc777 send', async () => {
          await this.proxy.place(defaultToken, this.erc777.address, cost);

          await expectRevert(
            this.erc777.send(this.proxy.address, web3.utils.toBN('1000000000000000000'), defaultToken, { from: accounts[1] }),
            'Transfer amount is not correct.',
          );
        });
      });

      afterEach(async () => {
        expect(
          await this.token.ownerOf(defaultToken),
        ).to.be.eq(
          accounts[0],
        );
      });
    });

    describe('should not allow to buy if contract is paused via', async () => {
      const cost = web3.utils.toBN('1000000000000000000');

      beforeEach(async () => {
        await this.token.approve(this.proxy.address, defaultToken);
      });

      it('erc20 approve + buy', async () => {
        await this.proxy.setWhitelistedPaymentToken(
          this.erc20.address, true, false, false,
        );

        await this.proxy.place(defaultToken, this.erc20.address, cost);

        await this.erc20.approve(this.proxy.address, cost, { from: accounts[1] });

        await this.proxy.pause();

        await expectRevert(
          this.proxy.buy(defaultToken, { from: accounts[1] }),
          'Pausable: paused -- Reason given: Pausable: paused.',
        );
      });

      it('erc677 transferAndCall', async () => {
        await this.proxy.setWhitelistedPaymentToken(
          this.erc677.address, false, true, false,
        );

        await this.proxy.place(defaultToken, this.erc677.address, cost);

        await this.proxy.pause();

        await expectRevert(
          this.erc677.transferAndCall(
            this.proxy.address,
            cost,
            defaultToken,
            { from: accounts[1] },
          ),
          'Pausable: paused -- Reason given: Pausable: paused.',
        );
      });

      it('erc777 send', async () => {
        await this.proxy.setWhitelistedPaymentToken(
          this.erc777.address, false, false, true,
        );

        await this.proxy.place(defaultToken, this.erc777.address, cost);

        await this.proxy.pause();

        await expectRevert(
          this.erc777.send(this.proxy.address, cost, defaultToken, { from: accounts[1] }),
          'Pausable: paused -- Reason given: Pausable: paused.',
        );
      });

      it('gas', async () => {
        await this.proxy.allowGasPayments(true);

        await this.proxy.place(defaultToken, constants.ZERO_ADDRESS, cost);

        await this.proxy.pause();

        await expectRevert(
          this.proxy.buy(defaultToken, { from: accounts[1], value: cost }),
          'Pausable: paused -- Reason given: Pausable: paused.',
        );
      });

      describe('erc20 + erc677', async () => {
        beforeEach(async () => {
          await this.proxy.setWhitelistedPaymentToken(
            this.erc677.address, true, true, false,
          );
        });

        it('erc20 approve + buy', async () => {
          await this.proxy.place(defaultToken, this.erc677.address, cost);

          await this.erc677.approve(this.proxy.address, cost, { from: accounts[1] });

          await this.proxy.pause();

          await expectRevert(
            this.proxy.buy(defaultToken, { from: accounts[1] }),
            'Pausable: paused -- Reason given: Pausable: paused.',
          );
        });

        it('erc677 transferAndCall', async () => {
          await this.proxy.place(defaultToken, this.erc677.address, cost);

          await this.proxy.pause();

          await expectRevert(
            this.erc677.transferAndCall(
              this.proxy.address,
              cost,
              defaultToken,
              { from: accounts[1] },
            ),
            'Pausable: paused -- Reason given: Pausable: paused.',
          );
        });
      });

      describe('erc20 + erc777', async () => {
        beforeEach(async () => {
          await this.proxy.setWhitelistedPaymentToken(
            this.erc777.address, true, false, true,
          );
        });

        it('erc20 approve + buy', async () => {
          await this.proxy.place(defaultToken, this.erc777.address, cost);

          await this.erc777.approve(this.proxy.address, cost, { from: accounts[1] });

          await this.proxy.pause();

          await expectRevert(
            this.proxy.buy(defaultToken, { from: accounts[1] }),
            'Pausable: paused -- Reason given: Pausable: paused.',
          );
        });

        it('erc777 send', async () => {
          await this.proxy.place(defaultToken, this.erc777.address, cost);

          await this.proxy.pause();

          await expectRevert(
            this.erc777.send(this.proxy.address, cost, defaultToken, { from: accounts[1] }),
            'Pausable: paused -- Reason given: Pausable: paused.',
          );
        });
      });

      afterEach(async () => {
        expect(
          await this.token.ownerOf(defaultToken),
        ).to.be.eq(
          accounts[0],
        );
      });
    });
  });

  describe('should only allow payment token to execute', async () => {
    const cost = web3.utils.toBN('1000000000000000000');

    beforeEach(async () => {
      await this.token.approve(
        this.proxy.address, defaultToken,
      );
    });

    it('erc677 tokeFallback', async () => {
      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await this.proxy.place(defaultToken, this.erc677.address, cost);

      await expectRevert(
        this.proxy.tokenFallback(accounts[1], cost, defaultToken),
        'Only from payment token.',
      );
    });

    it('erc777 tokensReceived', async () => {
      await this.proxy.setWhitelistedPaymentToken(
        this.erc677.address, false, false, true,
      );

      await this.proxy.place(defaultToken, this.erc677.address, cost);

      await expectRevert(
        this.proxy.tokensReceived(
          constants.ZERO_ADDRESS,
          accounts[1],
          constants.ZERO_ADDRESS,
          cost,
          defaultToken,
          '0x00',
        ),
        'Only from payment token.',
      );
    });
  });
}

module.exports = {
  shouldBehaveLikeSimplePlacement,
};
