const BytesLib = artifacts.require('BytesLib');
const ERC721Mintable = artifacts.require('ERC721Mintable');
const ERC1820 = require('erc1820');

const ERC20 = artifacts.require('ERC20Mintable');
const ERC677 = artifacts.require('ERC677');
const ERC777 = artifacts.require('ERC777Mintable');
const ERC721SimplePlacements = artifacts.require('ERC721SimplePlacements');

const { expect } = require('chai');
const { expectRevert, expectEvent, constants } = require('@openzeppelin/test-helpers');

contract('ERC721 Simple Placements', (accounts) => {
  const defaultToken = web3.utils.sha3('DEFAULT_TOKEN');

  beforeEach(async () => {
    this.token = await ERC721Mintable.new();
    await this.token.mint(accounts[0], defaultToken);

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
    await ERC721SimplePlacements.link('BytesLib', bytesLib.address);

    this.simplePlacements = await ERC721SimplePlacements.new(this.token.address);
  });

  describe('ownership', async () => {
    it('creator should be the owner', async () => {
      const owner = await this.simplePlacements.owner();

      expect(
        owner,
      ).to.eq(
        accounts[0],
      );
    });

    it('should not allow not owner to set new owner', async () => {
      await expectRevert(
        this.simplePlacements.transferOwnership(accounts[1], { from: accounts[1] }),
        'Ownable: caller is not the owner',
      );
    });

    it('should allow owner to set new owner', async () => {
      await this.simplePlacements.transferOwnership(accounts[1]);

      const owner = await this.simplePlacements.owner();

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
        this.simplePlacements.setWhitelistedPaymentToken(
          token.address, true, false, false, { from: accounts[1] },
        ),
        'Ownable: caller is not the owner',
      );

      const whitelisted = await this.simplePlacements.whitelistedPaymentToken(token.address);

      expect(whitelisted[0]).to.eq(false);
      expect(whitelisted[1]).to.eq(false);
      expect(whitelisted[2]).to.eq(false);
    });

    it('should not allow not owner to allow gas payments', async () => {
      await expectRevert(
        this.simplePlacements.allowGasPayments(true, { from: accounts[1] }),
        'Ownable: caller is not the owner',
      );

      // eslint-disable-next-line no-unused-expressions
      expect(await this.simplePlacements.isGasPaymentAllowed()).to.be.false;
    });

    it('should allow owner to set whitelisted token', async () => {
      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, true, true, false,
      );

      const whitelisted = await this.simplePlacements.whitelistedPaymentToken(this.erc677.address);

      expect(whitelisted[0]).to.eq(true);
      expect(whitelisted[1]).to.eq(true);
      expect(whitelisted[2]).to.eq(false);
    });

    it('should only allow to allow gas payments', async () => {
      await this.simplePlacements.allowGasPayments(true);

      // eslint-disable-next-line no-unused-expressions
      expect(await this.simplePlacements.isGasPaymentAllowed()).to.be.true;
    });

    it('should allow owner to remove whitelisted tokens', async () => {
      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, true, true, false,
      );

      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, false, false, false,
      );

      const whitelisted = await this.simplePlacements.whitelistedPaymentToken(this.erc677.address);

      expect(whitelisted[0]).to.eq(false);
      expect(whitelisted[1]).to.eq(false);
      expect(whitelisted[2]).to.eq(false);
    });

    it('should allow owner to remove approval for gas payments', async () => {
      await this.simplePlacements.allowGasPayments(true);

      await this.simplePlacements.allowGasPayments(false);

      // eslint-disable-next-line no-unused-expressions
      expect(await this.simplePlacements.isGasPaymentAllowed()).to.be.false;
    });

    it('should emit PaymentTokenWhitelisted event', async () => {
      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, true, true, false,
      );

      const logs = await this.simplePlacements.getPastEvents('allEvents');

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
      const notPlaced = web3.utils.sha3('NOT_PLACED');

      await expectRevert(
        this.simplePlacements.placement(notPlaced),
        'Token not placed.',
      );
    });

    it('should not allow to place token with not whitelisted payment token', async () => {
      await this.token.approve(this.simplePlacements.address, defaultToken);

      await expectRevert(
        this.simplePlacements.place(defaultToken, this.erc677.address, cost),
        'Payment token not allowed.',
      );
    });

    it('should not allow to place token for gas if it is not allowed', async () => {
      await this.token.approve(this.simplePlacements.address, defaultToken);

      await expectRevert(
        this.simplePlacements.place(defaultToken, constants.ZERO_ADDRESS, cost),
        'Payment token not allowed.',
      );
    });

    it('should not allow to place not approved token', async () => {
      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await expectRevert(
        this.simplePlacements.place(defaultToken, this.erc677.address, cost),
        'Not approved to transfer.',
      );

      await expectRevert(
        this.simplePlacements.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should not allow not owner or controller to place token', async () => {
      await this.token.approve(this.simplePlacements.address, defaultToken);

      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await expectRevert(
        this.simplePlacements.place(defaultToken, this.erc677.address, cost, { from: accounts[3] }),
        'Not approved or owner.',
      );

      await expectRevert(
        this.simplePlacements.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should not allow to place with zero cost', async () => {
      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await this.token.approve(this.simplePlacements.address, defaultToken);

      await expectRevert(
        this.simplePlacements.place(defaultToken, this.erc677.address, 0),
        'Cost should be greater than zero.',
      );

      await expectRevert(
        this.simplePlacements.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should allow owner to place token', async () => {
      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await this.token.approve(this.simplePlacements.address, defaultToken);

      await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

      const placement = await this.simplePlacements.placement(defaultToken);

      expect(placement[0]).to.eq(this.erc677.address);
      expect(placement[1]).to.be.bignumber.equal(cost);
    });

    it('should allow controller to place token', async () => {
      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await this.token.approve(this.simplePlacements.address, defaultToken);

      await this.token.setApprovalForAll(accounts[2], true);

      await this.simplePlacements.place(
        defaultToken, this.erc677.address, cost, { from: accounts[2] },
      );

      const placement = await this.simplePlacements.placement(defaultToken);

      expect(placement[0]).to.eq(this.erc677.address);
      expect(placement[1]).to.be.bignumber.equal(cost);
    });

    it('should emit TokenPlaced event', async () => {
      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await this.token.approve(this.simplePlacements.address, defaultToken);

      await this.token.setApprovalForAll(accounts[2], true);

      const receipt = await this.simplePlacements.place(
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
  });

  describe('unplacing', async () => {
    const cost = web3.utils.toBN('1000000000000000000');

    beforeEach(async () => {
      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );
    });

    it('should allow anyone to unplace not approved tokens', async () => {
      await this.token.approve(this.simplePlacements.address, defaultToken);

      await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

      await this.token.approve(constants.ZERO_ADDRESS, defaultToken);

      await this.simplePlacements.unplace(defaultToken);

      await expectRevert(
        this.simplePlacements.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should allow anyone to unplace transferred tokens', async () => {
      await this.token.approve(this.simplePlacements.address, defaultToken);

      await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

      await this.token.transferFrom(accounts[0], accounts[2], defaultToken);

      await this.simplePlacements.unplace(defaultToken);

      await expectRevert(
        this.simplePlacements.placement(defaultToken),
        'Token not placed.',
      );
    });

    it('should emit TokenUnplaced event', async () => {
      await this.token.approve(this.simplePlacements.address, defaultToken);

      await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

      await this.token.approve(constants.ZERO_ADDRESS, defaultToken);

      const receipt = await this.simplePlacements.unplace(defaultToken);

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
        await this.token.approve(this.simplePlacements.address, defaultToken);
      });

      it('erc20 approve + buy', async () => {
        await this.simplePlacements.setWhitelistedPaymentToken(
          this.erc20.address, false, true, false,
        );

        await this.simplePlacements.place(defaultToken, this.erc20.address, cost);

        await this.erc20.approve(this.simplePlacements.address, cost, { from: accounts[1] });

        await expectRevert(
          this.simplePlacements.buy(defaultToken, { from: accounts[1] }),
          'Wrong purchase method.',
        );
      });

      it('erc677 transferAndCall', async () => {
        await this.simplePlacements.setWhitelistedPaymentToken(
          this.erc677.address, true, false, false,
        );

        await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

        await expectRevert(
          this.erc677.transferAndCall(
            this.simplePlacements.address,
            cost,
            defaultToken,
            { from: accounts[1] },
          ),
          'Wrong purchase method.',
        );
      });

      it('erc777 send', async () => {
        await this.simplePlacements.setWhitelistedPaymentToken(
          this.erc777.address, true, false, false,
        );

        await this.simplePlacements.place(defaultToken, this.erc777.address, cost);

        await expectRevert(
          this.erc777.send(
            this.simplePlacements.address,
            cost,
            defaultToken,
            { from: accounts[1] },
          ),
          'Wrong purchase method.',
        );
      });

      it('gas', async () => {
        await this.simplePlacements.allowGasPayments(true);

        await this.simplePlacements.place(defaultToken, constants.ZERO_ADDRESS, cost);

        await this.simplePlacements.allowGasPayments(false);

        await expectRevert(
          this.simplePlacements.buy(defaultToken, { from: accounts[1], value: cost }),
          'Wrong purchase method.',
        );
      });

      describe('erc20 + erc677', async () => {
        beforeEach(async () => {
          await this.simplePlacements.setWhitelistedPaymentToken(
            this.erc677.address, false, false, true,
          );
        });

        it('approve + buy', async () => {
          await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

          await this.erc677.approve(this.simplePlacements.address, cost, { from: accounts[1] });

          await expectRevert(
            this.simplePlacements.buy(defaultToken, { from: accounts[1] }),
            'Wrong purchase method.',
          );
        });

        it('transferAndCall', async () => {
          await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

          await expectRevert(
            this.erc677.transferAndCall(
              this.simplePlacements.address,
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
          await this.simplePlacements.setWhitelistedPaymentToken(
            this.erc777.address, false, true, false,
          );
        });

        it('approve + buy', async () => {
          await this.simplePlacements.place(defaultToken, this.erc777.address, cost);

          await this.erc777.approve(this.simplePlacements.address, cost, { from: accounts[1] });

          await expectRevert(
            this.simplePlacements.buy(defaultToken, { from: accounts[1] }),
            'Wrong purchase method.',
          );
        });

        it('send', async () => {
          await this.simplePlacements.place(defaultToken, this.erc777.address, cost);

          await expectRevert(
            this.erc777.send(
              this.simplePlacements.address,
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
      const notPlaced = web3.utils.sha3('NOT_PLACED');
      const cost = web3.utils.toBN('1000000000000000000');

      beforeEach(async () => {
        await this.token.mint(accounts[0], notPlaced);
      });

      it('erc20 approve + buy', async () => {
        await this.simplePlacements.setWhitelistedPaymentToken(
          this.erc20.address, true, false, false,
        );

        await this.erc20.approve(this.simplePlacements.address, cost, { from: accounts[1] });

        await expectRevert(
          this.simplePlacements.buy(notPlaced, { from: accounts[1] }),
          'Token not placed.',
        );
      });

      it('erc677 transferAndCall', async () => {
        await this.simplePlacements.setWhitelistedPaymentToken(
          this.erc677.address, false, true, false,
        );

        await expectRevert(
          this.erc677.transferAndCall(
            this.simplePlacements.address, cost, notPlaced, { from: accounts[1] },
          ),
          'Token not placed.',
        );
      });

      it('erc777 send', async () => {
        await this.simplePlacements.setWhitelistedPaymentToken(
          this.erc777.address, false, false, true,
        );

        await expectRevert(
          this.erc777.send(this.simplePlacements.address, cost, notPlaced, { from: accounts[1] }),
          'Token not placed.',
        );
      });

      it('gas', async () => {
        await this.simplePlacements.allowGasPayments(true);

        await expectRevert(
          this.erc777.send(this.simplePlacements.address, cost, notPlaced, { from: accounts[1] }),
          'Token not placed.',
        );
      });

      describe('erc20 + erc677', async () => {
        beforeEach(async () => {
          await this.simplePlacements.setWhitelistedPaymentToken(
            this.erc677.address, true, true, false,
          );
        });

        it('approve + buy', async () => {
          await this.erc677.approve(this.simplePlacements.address, cost, { from: accounts[1] });

          await expectRevert(
            this.simplePlacements.buy(notPlaced, { from: accounts[1] }),
            'Token not placed.',
          );
        });

        it('transferAndCall', async () => {
          await expectRevert(
            this.erc677.transferAndCall(
              this.simplePlacements.address, cost, notPlaced, { from: accounts[1] },
            ),
            'Token not placed.',
          );
        });
      });

      describe('erc20 + erc777', async () => {
        beforeEach(async () => {
          await this.simplePlacements.setWhitelistedPaymentToken(
            this.erc777.address, false, true, true,
          );
        });

        it('erc20 approve + transfer', async () => {
          await this.erc777.approve(this.simplePlacements.address, cost, { from: accounts[1] });

          await expectRevert(
            this.simplePlacements.buy(notPlaced, { from: accounts[1] }),
            'Token not placed.',
          );
        });

        it('erc777 send', async () => {
          await expectRevert(
            this.erc777.send(this.simplePlacements.address, cost, notPlaced, { from: accounts[1] }),
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
          await this.token.approve(this.simplePlacements.address, defaultToken);
        });

        it('erc20 approve + buy', async () => {
          await this.simplePlacements.setWhitelistedPaymentToken(
            this.erc20.address, true, false, false,
          );

          await this.simplePlacements.place(defaultToken, this.erc20.address, cost);

          await this.erc20.approve(this.simplePlacements.address, cost, { from: accounts[1] });

          await this.simplePlacements.buy(defaultToken, { from: accounts[1] });
        });

        it('erc677 transferAndCall', async () => {
          await this.simplePlacements.setWhitelistedPaymentToken(
            this.erc677.address, false, true, false,
          );

          await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

          await this.erc677.transferAndCall(
            this.simplePlacements.address,
            cost,
            defaultToken,
            { from: accounts[1] },
          );
        });

        it('erc777 send', async () => {
          await this.simplePlacements.setWhitelistedPaymentToken(
            this.erc777.address, false, false, true,
          );

          await this.simplePlacements.place(defaultToken, this.erc777.address, cost);

          await this.erc777.send(
            this.simplePlacements.address,
            cost,
            defaultToken,
            { from: accounts[1] },
          );
        });

        it('gas', async () => {
          await this.simplePlacements.allowGasPayments(true);

          await this.simplePlacements.place(defaultToken, constants.ZERO_ADDRESS, cost);

          await this.simplePlacements.buy(defaultToken, { from: accounts[1], value: cost });
        });

        describe('erc20 + erc677', async () => {
          beforeEach(async () => {
            await this.simplePlacements.setWhitelistedPaymentToken(
              this.erc677.address, true, true, false,
            );
          });

          it('erc20 approve + buy', async () => {
            await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

            await this.erc677.approve(this.simplePlacements.address, cost, { from: accounts[1] });

            await this.simplePlacements.buy(defaultToken, { from: accounts[1] });
          });

          it('erc677 transferAndCall', async () => {
            await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

            await this.erc677.transferAndCall(
              this.simplePlacements.address,
              cost,
              defaultToken,
              { from: accounts[1] },
            );
          });
        });

        describe('erc20 + erc777', async () => {
          beforeEach(async () => {
            await this.simplePlacements.setWhitelistedPaymentToken(
              this.erc777.address, true, false, true,
            );
          });

          it('erc20 approve + buy', async () => {
            await this.simplePlacements.place(defaultToken, this.erc777.address, cost);

            await this.erc777.approve(this.simplePlacements.address, cost, { from: accounts[1] });

            await this.simplePlacements.buy(defaultToken, { from: accounts[1] });
          });

          it('erc777 send', async () => {
            await this.simplePlacements.place(defaultToken, this.erc777.address, cost);

            await this.erc777.send(
              this.simplePlacements.address,
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
            await this.simplePlacements.getPastEvents('allEvents'),
            'TokenSold',
            {
              tokenId: web3.utils.toBN(defaultToken),
            },
          );

          await expectRevert(
            this.simplePlacements.placement(defaultToken),
            'Token not placed.',
          );
        });
      },
    );

    describe('should not transfer placed token when not enough are sent via', async () => {
      const cost = web3.utils.toBN('2000000000000000000');

      beforeEach(async () => {
        await this.token.approve(this.simplePlacements.address, defaultToken);
      });

      it('erc20 approve + buy', async () => {
        await this.simplePlacements.setWhitelistedPaymentToken(
          this.erc20.address, true, false, false,
        );

        await this.simplePlacements.place(defaultToken, this.erc20.address, cost);

        await this.erc677.approve(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), { from: accounts[1] });

        await expectRevert(
          this.simplePlacements.buy(defaultToken, { from: accounts[1] }),
          'ERC20: transfer amount exceeds allowance -- Reason given: ERC20: transfer amount exceeds allowance.',
        );
      });

      it('erc677 transferAndCall', async () => {
        await this.simplePlacements.setWhitelistedPaymentToken(
          this.erc677.address, false, true, false,
        );

        await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

        await expectRevert(
          this.erc677.transferAndCall(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), defaultToken, { from: accounts[1] }),
          'ERC20: transfer amount exceeds balance -- Reason given: ERC20: transfer amount exceeds balance.',
        );
      });

      it('erc777 send', async () => {
        await this.simplePlacements.setWhitelistedPaymentToken(
          this.erc777.address, false, false, true,
        );

        await this.simplePlacements.place(defaultToken, this.erc777.address, cost);

        await expectRevert(
          this.erc777.send(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), defaultToken, { from: accounts[1] }),
          'ERC777: transfer amount exceeds balance -- Reason given: ERC777: transfer amount exceeds balance.',
        );
      });

      it('gas', async () => {
        await this.simplePlacements.allowGasPayments(true);

        await this.simplePlacements.place(defaultToken, constants.ZERO_ADDRESS, cost);

        await expectRevert(
          this.simplePlacements.buy(defaultToken, { from: accounts[1], value: web3.utils.toBN('1000000000000000000') }),
          'Transfer amount is not enough.',
        );
      });

      describe('erc20 + erc677', async () => {
        beforeEach(async () => {
          await this.simplePlacements.setWhitelistedPaymentToken(
            this.erc677.address, true, true, false,
          );
        });

        it('erc20 approve + buy', async () => {
          await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

          await this.erc677.approve(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), { from: accounts[1] });

          await expectRevert(
            this.simplePlacements.buy(defaultToken, { from: accounts[1] }),
            'ERC20: transfer amount exceeds allowance -- Reason given: ERC20: transfer amount exceeds allowance.',
          );
        });

        it('erc677 transferAndCall', async () => {
          await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

          await expectRevert(
            this.erc677.transferAndCall(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), defaultToken, { from: accounts[1] }),
            'ERC20: transfer amount exceeds balance -- Reason given: ERC20: transfer amount exceeds balance.',
          );
        });
      });

      describe('erc20 + erc777', async () => {
        beforeEach(async () => {
          await this.simplePlacements.setWhitelistedPaymentToken(
            this.erc777.address, true, false, true,
          );
        });

        it('erc20 approve + buy', async () => {
          await this.simplePlacements.place(defaultToken, this.erc777.address, cost);

          await this.erc777.approve(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), { from: accounts[1] });

          await expectRevert(
            this.simplePlacements.buy(defaultToken, { from: accounts[1] }),
            'ERC777: transfer amount exceeds allowance -- Reason given: ERC777: transfer amount exceeds allowance.',
          );
        });

        it('erc777 send', async () => {
          await this.simplePlacements.place(defaultToken, this.erc777.address, cost);

          await expectRevert(
            this.erc777.send(this.simplePlacements.address, web3.utils.toBN('1000000000000000000'), defaultToken, { from: accounts[1] }),
            'ERC777: transfer amount exceeds balance -- Reason given: ERC777: transfer amount exceeds balance.',
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
        this.simplePlacements.address, defaultToken,
      );
    });

    it('erc677 tokeFallback', async () => {
      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, false, true, false,
      );

      await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

      await expectRevert(
        this.simplePlacements.tokenFallback(accounts[1], cost, defaultToken),
        'Only from payment token.',
      );
    });

    it('erc777 tokensReceived', async () => {
      await this.simplePlacements.setWhitelistedPaymentToken(
        this.erc677.address, false, false, true,
      );

      await this.simplePlacements.place(defaultToken, this.erc677.address, cost);

      await expectRevert(
        this.simplePlacements.tokensReceived(
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
});
