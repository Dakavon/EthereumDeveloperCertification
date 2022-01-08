//B9lab ETH-SUB Ethereum Developer Subscription Course
//>>> Exam <<< - Test file
//
//Last update: 20.03.2021

const Regulator = artifacts.require("Regulator");
const TollBoothOperator = artifacts.require("TollBoothOperator.sol");
const truffleAssert = require("truffle-assertions");
const randomIntIn = require("../utils/randomIntIn.js");
const { toBN, padLeft } = web3.utils;


contract("TollBoothOperator", (accounts) => {

    let regulatorInstance = null;
    let operatorInstance = null;
    const [regulator, operator, sender, attacker, booth1, booth2, booth3, vehicle1, vehicle2, vehicle3] = accounts;
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    const initialDeposit = Math.floor(Math.random() * 1000) + 1;


    before("should be ten accounts available: ", async () => {
        assert.isAtLeast(accounts.length, 10);
        console.log("\n    There are five accounts available:");
        for(let i=0; i<10; i++){
            console.log(`\t#${i}: ${accounts[i]}`);
        }
        console.log("\n");
    });


    describe("constructor()", async () => {

        //more unit tests performed for createNewOperator() in test/regulator.test.js

        it("should fail if value is sent along", async () => {
            await truffleAssert.fails(
                TollBoothOperator.new(true, initialDeposit, regulator, {from: operator, value: 1})
            );
        });

        it("should fail (through DepositHolder) if the initialbaseDepositWeis argument is 0", async () => {
            await truffleAssert.reverts(
                TollBoothOperator.new(true, 0, regulator, {from: operator}),
                "DepositHolder: initialbaseDepositWeis must be greater than 0"
            );
        });

        it("should fail (through Regulated) if the initial regulator is 0x0", async () => {
            await truffleAssert.reverts(
                TollBoothOperator.new(true, initialDeposit, zeroAddress, {from: operator}),
                "Regulated: initialRegulator cannot be 0x0"
            );
        });

        it("should emit events", async () => {
            operatorInstance = await TollBoothOperator.new(true, initialDeposit, regulator, {from: operator});

            const txReceipt = await web3.eth.getTransactionReceipt(operatorInstance.transactionHash);
            assert.strictEqual(txReceipt.logs.length, 3, "three events should be emitted during deployment");
        });

        it("should have correct values from the beginning", async () => {
            operatorInstance = await TollBoothOperator.new(true, initialDeposit, regulator, {from: operator});

            assert.isTrue(await operatorInstance.isPaused(), "contract was not paused");
            const isDepositValue = await operatorInstance.getDeposit();
            assert.strictEqual(isDepositValue.toString(10), initialDeposit.toString(10), "contract has wrong deposit value");
            const isRegulator = await operatorInstance.getRegulator();
            assert.strictEqual(isRegulator, regulator, "contract has wrong regulator");
        });

    });


    describe("fallback() - rejects all incoming calls", async () => {

        beforeEach("deploy new instance", async () => {
            operatorInstance = await TollBoothOperator.new(
                false, initialDeposit, regulator,
                {from: operator}
            );
        });

        it("should revert if fallback is called", async () => {
            await truffleAssert.fails(
                web3.eth.call({from: sender, to: operatorInstance.address})
            );
        });

        it("should revert if fallback is called through transaction", async () => {
            await truffleAssert.fails(
                web3.eth.sendTransaction({from: sender, to: operatorInstance.address})
            );
        });

        it("should revert if fallback is called through transaction with value", async () => {
            await truffleAssert.fails(
                web3.eth.sendTransaction({from: sender, to: operatorInstance.address, value: 1})
            );
        });

    });


    describe("function hashSecret()", async () => {

        const clearPassword = "passwordDummy";
        const hexClearPassword = web3.utils.asciiToHex(clearPassword);

        const emptyPassword = "";
        const hexEmptyPassword = web3.utils.asciiToHex(emptyPassword);

        beforeEach("deploy new instance", async () => {
            operatorInstance = await TollBoothOperator.new(
                false, initialDeposit, regulator,
                {from: operator}
            );
        });

        it("should fail if value is sent along", async () => {
            await truffleAssert.fails(
                operatorInstance.hashSecret(hexClearPassword, {from: sender, value: 1})
            );
        });

        it("game hash should match with soliditySha3", async () => {
            const gameHash = web3.utils.soliditySha3(
                {t: 'bytes32', v: hexClearPassword},
                {t: 'address', v: operatorInstance.address},
            );
            const _gameHash = await operatorInstance.hashSecret(hexClearPassword, {from: sender});

            assert.strictEqual(_gameHash, gameHash, "gameHash does not match");
        });

        it("game hash should match with soliditySha3 with '0' secret as a valid input", async () => {
            const gameHash = web3.utils.soliditySha3(
                {t: 'bytes32', v: hexEmptyPassword},
                {t: 'address', v: operatorInstance.address},
            );
            const _gameHash = await operatorInstance.hashSecret(hexEmptyPassword, {from: sender});

            assert.strictEqual(_gameHash, gameHash, "gameHash does not match");
        });

    });


    describe("function addTollBooth() / removeTollBooth() when paused", async () => {
        beforeEach("deploy new instance", async () => {
            operatorInstance = await TollBoothOperator.new(
                true, initialDeposit, regulator,
                {from: operator}
            );
        });

        it("should be possible to add toll booths even when the contract is paused", async () => {
            const pausedState = await operatorInstance.isPaused();
            assert.isTrue(pausedState, "contract is not in paused state");

            const returned = await operatorInstance.addTollBooth.call(booth1, {from: operator});
            assert.strictEqual(returned, true, "toll booth cannot be added");

            const txObj = await operatorInstance.addTollBooth(booth1, {from: operator});
            truffleAssert.eventEmitted(txObj, 'LogTollBoothAdded');

            const logSender     = txObj.receipt.logs[0].args.sender;
            const logTollBooth  = txObj.receipt.logs[0].args.tollBooth;
            assert.strictEqual(logSender, operator, "sender was not logged correctly");
            assert.strictEqual(logTollBooth, booth1, "tollBooth was not logged correctly");

            const isTollBooth = await operatorInstance.isTollBooth(booth1);
            assert.strictEqual(isTollBooth, true, "toll booth was not added by operator");
        });

        it("should be possible to remove toll booth even when the contract is paused", async () => {
            const pausedState = await operatorInstance.isPaused();
            assert.isTrue(pausedState, "contract is not in paused state");

            await operatorInstance.addTollBooth(booth1, {from: operator});

            const returned = await operatorInstance.removeTollBooth.call(booth1, {from: operator});
            assert.strictEqual(returned, true, "toll booth cannot be removed");

            const txObj = await operatorInstance.removeTollBooth(booth1, {from: operator});
            truffleAssert.eventEmitted(txObj, 'LogTollBoothRemoved');

            const logSender     = txObj.receipt.logs[0].args.sender;
            const logTollBooth  = txObj.receipt.logs[0].args.tollBooth;
            assert.strictEqual(logSender, operator, "sender was not logged correctly");
            assert.strictEqual(logTollBooth, booth1, "tollBooth was not logged correctly");

            const isTollBooth = await operatorInstance.isTollBooth(booth1);
            assert.strictEqual(isTollBooth, false, "toll booth was not removed by operator");
        });

    });


    describe("Process vehicles", async () => {

        const vehicleType1 = randomIntIn(1, 10);
        const vehicleType2 = vehicleType1 + randomIntIn(1, 10);
        const vehicleType3 = vehicleType1;

        const multiplier1 = randomIntIn(2, 10);
        const multiplier2 = multiplier1 + 1;
        const multiplier3 = multiplier1;

        const standardRoutePrice = initialDeposit;
        const lowRoutePrice = Math.floor(standardRoutePrice / 2);
        const highRoutePrice = standardRoutePrice * 2;

        const deposit1 = standardRoutePrice * multiplier1;
        const deposit2 = highRoutePrice * multiplier2;
        const deposit3 = deposit1;

        const secret1 = padLeft(1, 64);
        const secret2 = padLeft(2, 64);
        const secret3 = padLeft(3, 64);
        const secret4 = padLeft(4, 64);
        const secret5 = padLeft(5, 64);
        let secret1Hash, secret2Hash, secret3Hash, secret4Hash, secret5Hash;


        beforeEach("deploy new instances (regulator and tollBoothOperator)", async () => {
            regulatorInstance = await Regulator.new({from: regulator});
            await regulatorInstance.setVehicleType(vehicle1, vehicleType1, {from: regulator});
            await regulatorInstance.setVehicleType(vehicle2, vehicleType2, {from: regulator});
            await regulatorInstance.setVehicleType(vehicle3, vehicleType3, {from: regulator});

            const txObj = await regulatorInstance.createNewOperator(operator, initialDeposit, {from: regulator});

            operatorInstance = await TollBoothOperator.at(txObj.logs[1].args.newOperator);
            await operatorInstance.addTollBooth(booth1, {from: operator});
            await operatorInstance.addTollBooth(booth2, {from: operator});
            await operatorInstance.addTollBooth(booth3, {from: operator});

            await operatorInstance.setMultiplier(vehicleType1, multiplier1, {from: operator});
            await operatorInstance.setMultiplier(vehicleType2, multiplier2, {from: operator});

            await operatorInstance.setRoutePrice(booth1, booth2, standardRoutePrice, {from: operator});
            await operatorInstance.setRoutePrice(booth1, booth3, highRoutePrice, {from: operator});
            await operatorInstance.setRoutePrice(booth2, booth3, lowRoutePrice, {from: operator});

            secret1Hash = await operatorInstance.hashSecret(secret1);
            secret2Hash = await operatorInstance.hashSecret(secret2);
            secret3Hash = await operatorInstance.hashSecret(secret3);
            secret4Hash = await operatorInstance.hashSecret(secret4);
            secret5Hash = await operatorInstance.hashSecret(secret5);

            await operatorInstance.setPaused(false, {from: operator});
        });

        describe("function enterRoad()", async () => {

            it("should fail if the contract is in the `true` paused state", async () => {
                await operatorInstance.setPaused(true, {from: operator});

                await truffleAssert.reverts(
                    operatorInstance.enterRoad(booth1, secret1Hash, {from: vehicle1, value: deposit1}),
                    "Pausable: Contract is paused"
                );
            });

            it("should fail if the vehicle is not a registered vehicle", async () => {
                await truffleAssert.reverts(
                    operatorInstance.enterRoad(booth1, secret1Hash, {from: attacker, value: deposit1}),
                    "TollBoothOperator: Vehicle is not a registered vehicle"
                );
            });

            it("should fail if the vehicle is not allowed on this road system", async () => {
                const vehicleType3 = vehicleType2 + randomIntIn(1, 10);
                await regulatorInstance.setVehicleType(vehicle3, vehicleType3, {from: regulator});

                await truffleAssert.reverts(
                    operatorInstance.enterRoad(booth1, secret1Hash, {from: vehicle3, value: deposit1}),
                    "TollBoothOperator: Vehicle is not allowed on this road system"
                );
            });

            it("should fail if `entryBooth` is not a tollBooth", async () => {
                await truffleAssert.reverts(
                    operatorInstance.enterRoad(sender, secret1Hash, {from: vehicle1, value: deposit1}),
                    "TollBoothOperator: entryBooth is not a tollBooth"
                );
            });

            it("should fail if less than deposit * multiplier was sent alongside", async () => {
                await truffleAssert.reverts(
                    operatorInstance.enterRoad(booth1, secret1Hash, {from: vehicle1, value: initialDeposit}),
                    "TollBoothOperator: Msg.value is less than the required deposit"
                );
            });

            it("should fail if `exitSecretHashed` has previously been used by anyone to enter", async () => {
                await operatorInstance.enterRoad(booth1, secret1Hash, {from: vehicle1, value: deposit1});

                await truffleAssert.reverts(
                    operatorInstance.enterRoad(booth1, secret1Hash, {from: vehicle2, value: deposit2}),
                    "TollBoothOperator: exitSecretHashed has previously been used"
                );
            });

            it("should be possible to enter the road by a vehicle", async () => {
                const returned = await operatorInstance.enterRoad.call(booth1, secret1Hash, {from: vehicle1, value: deposit1});
                assert.strictEqual(returned, true, "vehicle cannot enter the road");

                const txObj = await operatorInstance.enterRoad(booth1, secret1Hash, {from: vehicle1, value: deposit1});
                truffleAssert.eventEmitted(txObj, 'LogRoadEntered');

                const logVehicle           = txObj.receipt.logs[0].args.vehicle;
                const logEntryBooth        = txObj.receipt.logs[0].args.entryBooth;
                const logExitSecretHashed  = txObj.receipt.logs[0].args.exitSecretHashed;
                const logMultiplier        = txObj.receipt.logs[0].args.multiplier;
                const logDepositedWeis     = txObj.receipt.logs[0].args.depositedWeis;

                assert.strictEqual(logVehicle, vehicle1, "vehicle was not logged correctly");
                assert.strictEqual(logEntryBooth, booth1, "entryBooth was not logged correctly");
                assert.strictEqual(logExitSecretHashed, secret1Hash, "exitSecretHashed was not logged correctly");
                assert.strictEqual(logMultiplier.toString(10), multiplier1.toString(10), "multiplier was not logged correctly");
                assert.strictEqual(logDepositedWeis.toString(10), deposit1.toString(10), "depositedWeis was not logged correctly");

                const vehicleEntries = await operatorInstance.getVehicleEntry(secret1Hash);

                assert.strictEqual(vehicleEntries.vehicle, vehicle1, "vehicle was not stored correctly");
                assert.strictEqual(vehicleEntries.entryBooth, booth1, "entryBooth was not stored correctly");
                assert.strictEqual(vehicleEntries.multiplier.toString(10), multiplier1.toString(10), "multiplier was not stored correctly");
                assert.strictEqual(vehicleEntries.depositedWeis.toString(10), deposit1.toString(10), "depositedWeis was not stored correctly");

                const operatorInstanceBalance = await web3.eth.getBalance(operatorInstance.address);
                const operatorPaymentBalance = await operatorInstance.getPayment(operator);
                const vehicle1PaymentBalance = await operatorInstance.getPayment(vehicle1);
                assert.strictEqual(operatorInstanceBalance.toString(10), deposit1.toString(10), "contract balance is not correct");
                assert.strictEqual(operatorPaymentBalance.toString(10), '0', "operator payment balance is not correct");
                assert.strictEqual(vehicle1PaymentBalance.toString(10), '0', "vehicle payment balance is not correct");
            });

            it("should be possible to enter the road by a vehicle with higher deposit", async () => {
                const higherDeposit1 = deposit1+1;

                const txObj = await operatorInstance.enterRoad(booth1, secret1Hash, {from: vehicle1, value: higherDeposit1});
                const logDepositedWeis = txObj.receipt.logs[0].args.depositedWeis;
                assert.isAbove(logDepositedWeis.toNumber(), deposit1, "higher deposit was not logged correctly");

                const vehicleEntries = await operatorInstance.getVehicleEntry(secret1Hash);
                assert.isAbove(vehicleEntries.depositedWeis.toNumber(), deposit1, "higher deposit was not stored correctly");

                const operatorInstanceBalance = await web3.eth.getBalance(operatorInstance.address);
                const operatorPaymentBalance = await operatorInstance.getPayment(operator);
                const vehicle1PaymentBalance = await operatorInstance.getPayment(vehicle1);
                assert.strictEqual(operatorInstanceBalance.toString(10), higherDeposit1.toString(10), "contract balance is not correct");
                assert.strictEqual(operatorPaymentBalance.toString(10), '0', "operator payment balance is not correct");
                assert.strictEqual(vehicle1PaymentBalance.toString(10), '0', "vehicle payment balance is not correct");
            });

        });

        describe("function reportExitRoad()", async () => {

            // before("show values for visual inspection:", async () => {
            //     console.log("\n\tinitialDeposit: ", initialDeposit);

            //     console.log("\n\tvehicleType1: ", vehicleType1);
            //     console.log("\tvehicleType2: ", vehicleType2);

            //     console.log("\n\tmultiplier1: ", multiplier1);
            //     console.log("\tmultiplier2: ", multiplier2);

            //     console.log("\n\tdeposit1: ", deposit1);
            //     console.log("\tdeposit2: ", deposit2);

            //     console.log("\n\troutePrice (booth1 -> booth2): ", standardRoutePrice);
            //     console.log("\troutePrice (booth1 -> booth3): ", highRoutePrice);
            //     console.log("\troutePrice (booth2 -> booth3): ", lowRoutePrice);
            //     console.log("\n");
            // });

            beforeEach("enter vehicles", async () => {
                await operatorInstance.enterRoad(booth1, secret1Hash, {from: vehicle1, value: deposit1});
                await operatorInstance.enterRoad(booth1, secret2Hash, {from: vehicle2, value: deposit2});
            });

            it("should fail if value is sent along", async () => {
                await truffleAssert.fails(
                    operatorInstance.reportExitRoad(secret1, {from: booth2, value: 1}),
                );
            });

            it("should fail if the contract is in the `true` paused state", async () => {
                await operatorInstance.setPaused(true, {from: operator});

                await truffleAssert.reverts(
                    operatorInstance.reportExitRoad(secret1, {from: booth2}),
                    "Pausable: Contract is paused"
                );
            });

            it("should fail if the sender is not a toll booth", async () => {
                await truffleAssert.reverts(
                    operatorInstance.reportExitRoad(secret1, {from: attacker}),
                    "TollBoothOperator: msg.sender is not a toll booth"
                );
            });

            it("should fail if the exit is same as the entry", async () => {
                await truffleAssert.reverts(
                    operatorInstance.reportExitRoad(secret1, {from: booth1}),
                    "TollBoothOperator: Exit is same as the entry"
                );
            });

            it("should fail if hashing the secret does not match a hashed one", async () => {
                await truffleAssert.reverts(
                    operatorInstance.reportExitRoad(secret3, {from: booth2}),
                    "TollBoothOperator: Hashing the secret does not match a hashed one"
                );
            });

            it("should fail if the secret has already been reported on exit", async () => {
                await operatorInstance.reportExitRoad(secret1, {from: booth2});

                await truffleAssert.reverts(
                    operatorInstance.reportExitRoad(secret1, {from: booth2}),
                    "TollBoothOperator: Secret has already been reported on exit"
                );
            });

            describe("if payment is processed instantly (route price was set)", async () => {

                it("should be possible report an exit (by a toll booth): deposit = routePrice", async () => {
                    const thisRoutePrice = await operatorInstance.getRoutePrice(booth1, booth2);
                    const exitFee = toBN(thisRoutePrice).mul(toBN(multiplier1));
                    assert.strictEqual(deposit1, exitFee.toNumber(), "this test is incorrect");

                    //visual check
                    // console.log("exitFee: ", exitFee.toString(10));
                    // console.log("deposit1:", deposit1.toString(10));

                    const returned = await operatorInstance.reportExitRoad.call(secret1, {from: booth2});
                    assert.strictEqual(returned.toNumber(), 1, "exit cannot be reported");

                    const txObj = await operatorInstance.reportExitRoad(secret1, {from: booth2});

                    //Check logs
                    truffleAssert.eventEmitted(txObj, 'LogRoadExited');
                    const logExitBooth          = txObj.receipt.logs[0].args.exitBooth;
                    const logExitSecretHashed   = txObj.receipt.logs[0].args.exitSecretHashed;
                    const logFinalFee           = txObj.receipt.logs[0].args.finalFee;
                    const logRefundWeis         = txObj.receipt.logs[0].args.refundWeis;

                    assert.strictEqual(logExitBooth, booth2, "exitBooth was not logged correctly");
                    assert.strictEqual(logExitSecretHashed, secret1Hash, "exitSecretHashed was not logged correctly");
                    assert.strictEqual(
                        logFinalFee.toString(10),
                        exitFee.toString(10),
                        "finalFee was not logged correctly"
                    );
                    assert.strictEqual(
                        logRefundWeis.toString(10),
                        '0',
                        "refundWeis was not logged correctly"
                    );

                    //visual check
                    // console.log("logFinalFee:", logFinalFee.toString(10));
                    // console.log("logRefundWeis:", logRefundWeis.toString(10))

                    //Check storages
                    const vehicleEntries = await operatorInstance.getVehicleEntry(secret1Hash);
                    assert.strictEqual(vehicleEntries.vehicle, zeroAddress, "vehicle was not deleted");
                    assert.strictEqual(vehicleEntries.entryBooth, booth1, "entryBooth was unintentional deleted");
                    assert.strictEqual(vehicleEntries.multiplier.toString(10), '0', "multiplier was not deleted");
                    assert.strictEqual(vehicleEntries.depositedWeis.toString(10), '0', "depositedWeis was not deleted");

                    //Check balances
                    const operatorInstanceBalance = await web3.eth.getBalance(operatorInstance.address);
                    const operatorPaymentBalance = await operatorInstance.getPayment(operator);
                    const vehicle1PaymentBalance = await operatorInstance.getPayment(vehicle1);
                    assert.strictEqual(operatorInstanceBalance.toString(10),
                        toBN(deposit1).add(toBN(deposit2)).toString(10),
                        "contract balance is not correct"
                    );
                    assert.strictEqual(
                        operatorPaymentBalance.toString(10),
                        exitFee.toString(10),
                        "operator payment balance is not correct");
                    assert.strictEqual(
                        vehicle1PaymentBalance.toString(10),
                        '0',
                        "vehicle payment balance is not correct"
                    );
                });

                it("should be possible report an exit (by a toll booth): deposit < routePrice", async () => {
                    const thisRoutePrice = await operatorInstance.getRoutePrice(booth1, booth3);
                    const exitFee = toBN(thisRoutePrice).mul(toBN(multiplier1));
                    assert.isBelow(deposit1, exitFee.toNumber(), "this test is incorrect");

                    //visual check
                    // console.log("deposit:", deposit1.toString(10))
                    // console.log("exitFee:", exitFee.toString(10));

                    const returned = await operatorInstance.reportExitRoad.call(secret1, {from: booth3});
                    assert.strictEqual(returned.toNumber(), 1, "exit cannot be reported");

                    const txObj = await operatorInstance.reportExitRoad(secret1, {from: booth3});

                    //Check logs
                    truffleAssert.eventEmitted(txObj, 'LogRoadExited');
                    const logExitBooth          = txObj.receipt.logs[0].args.exitBooth;
                    const logExitSecretHashed   = txObj.receipt.logs[0].args.exitSecretHashed;
                    const logFinalFee           = txObj.receipt.logs[0].args.finalFee;
                    const logRefundWeis         = txObj.receipt.logs[0].args.refundWeis;

                    assert.strictEqual(logExitBooth, booth3, "exitBooth was not logged correctly");
                    assert.strictEqual(logExitSecretHashed, secret1Hash, "exitSecretHashed was not logged correctly");
                    assert.strictEqual(
                        logFinalFee.toString(10),
                        deposit1.toString(10),
                        "finalFee was not logged correctly"
                    );
                    assert.strictEqual(
                        logRefundWeis.toString(10),
                        '0',
                        "refundWeis was not logged correctly"
                    );

                    //visual check
                    // console.log("logFinalFee:", logFinalFee.toString(10));
                    // console.log("logRefundWeis:", logRefundWeis.toString(10))

                    //Check balances
                    const operatorInstanceBalance = await web3.eth.getBalance(operatorInstance.address);
                    const operatorPaymentBalance = await operatorInstance.getPayment(operator);
                    const vehicle1PaymentBalance = await operatorInstance.getPayment(vehicle1);
                    assert.strictEqual(operatorInstanceBalance.toString(10),
                        toBN(deposit1).add(toBN(deposit2)).toString(10),
                        "contract balance is not correct"
                    );
                    assert.strictEqual(
                        operatorPaymentBalance.toString(10),
                        deposit1.toString(10),
                        "operator payment balance is not correct");
                    assert.strictEqual(
                        vehicle1PaymentBalance.toString(10),
                        '0',
                        "vehicle payment balance is not correct"
                    );
                });

                it("should be possible report an exit (by a toll booth): deposit > routePrice", async () => {
                    const thisRoutePrice = await operatorInstance.getRoutePrice(booth1, booth2);
                    const exitFee = toBN(thisRoutePrice).mul(toBN(multiplier2));
                    assert.isAbove(deposit2, exitFee.toNumber(), "this test is incorrect");

                    //visual check
                    // console.log("deposit:", deposit2.toString(10));
                    // console.log("exitFee:", exitFee.toString(10));

                    const returned = await operatorInstance.reportExitRoad.call(secret2, {from: booth2});
                    assert.strictEqual(returned.toNumber(), 1, "exit cannot be reported");

                    const txObj = await operatorInstance.reportExitRoad(secret2, {from: booth2});

                    //Check logs
                    truffleAssert.eventEmitted(txObj, 'LogRoadExited');
                    const logExitBooth          = txObj.receipt.logs[0].args.exitBooth;
                    const logExitSecretHashed   = txObj.receipt.logs[0].args.exitSecretHashed;
                    const logFinalFee           = txObj.receipt.logs[0].args.finalFee;
                    const logRefundWeis         = txObj.receipt.logs[0].args.refundWeis;

                    assert.strictEqual(logExitBooth, booth2, "exitBooth was not logged correctly");
                    assert.strictEqual(logExitSecretHashed, secret2Hash, "exitSecretHashed was not logged correctly");
                    assert.strictEqual(
                        logFinalFee.toString(10),
                        exitFee.toString(10),
                        "finalFee was not logged correctly"
                    );
                    assert.strictEqual(
                        logRefundWeis.toString(10),
                        toBN(deposit2).sub(toBN(exitFee)).toString(10),
                        "refundWeis was not logged correctly"
                    );

                    //visual check
                    // console.log("logFinalFee:", logFinalFee.toString(10));
                    // console.log("logRefundWeis:", logRefundWeis.toString(10));

                    //Check balances
                    const operatorInstanceBalance = await web3.eth.getBalance(operatorInstance.address);
                    const operatorPaymentBalance = await operatorInstance.getPayment(operator);
                    const vehicle2PaymentBalance = await operatorInstance.getPayment(vehicle2);
                    assert.strictEqual(operatorInstanceBalance.toString(10),
                        toBN(deposit1).add(toBN(deposit2)).toString(10),
                        "contract balance is not correct"
                    );
                    assert.strictEqual(
                        operatorPaymentBalance.toString(10),
                        exitFee.toString(10),
                        "operator payment balance is not correct");
                    assert.strictEqual(
                        vehicle2PaymentBalance.toString(10),
                        toBN(deposit2).sub(toBN(exitFee)).toString(10),
                        "vehicle payment balance is not correct"
                    );
                });

            });

            describe("if payment is processed after route price was set", async () => {

                it("should be possible to have a pending payment", async () => {
                    const thisRoutePrice = await operatorInstance.getRoutePrice(booth2, booth1);
                    assert.strictEqual(thisRoutePrice.toString(10), '0', "this test is incorrect");

                    await operatorInstance.enterRoad(booth2, secret3Hash, {from: vehicle3, value: deposit3});

                    const returned = await operatorInstance.reportExitRoad.call(secret3, {from: booth1});
                    assert.strictEqual(returned.toNumber(), 2, "exit cannot be reported");

                    const txObj = await operatorInstance.reportExitRoad(secret3, {from: booth1});

                    //Check logs
                    truffleAssert.eventEmitted(txObj, 'LogPendingPayment');
                    const logExitSecretHashed   = txObj.receipt.logs[0].args.exitSecretHashed;
                    const logEntryBooth         = txObj.receipt.logs[0].args.entryBooth;
                    const logExitBooth          = txObj.receipt.logs[0].args.exitBooth;

                    assert.strictEqual(logExitSecretHashed, secret3Hash, "exitSecretHashed was not logged correctly");
                    assert.strictEqual(logEntryBooth, booth2, "entryBooth was not logged correctly");
                    assert.strictEqual(logExitBooth, booth1, "exitBooth was not logged correctly");

                    //Check storages
                    const vehicleEntries = await operatorInstance.getVehicleEntry(secret3Hash);
                    assert.strictEqual(vehicleEntries.vehicle, vehicle3, "vehicle is not stored correctly");
                    assert.strictEqual(vehicleEntries.entryBooth, booth2, "entryBooth is not stored correctly");
                    assert.strictEqual(vehicleEntries.multiplier.toString(10), multiplier3.toString(10), "multiplier is not stored correctly");
                    assert.strictEqual(vehicleEntries.depositedWeis.toString(10), deposit3.toString(10), "depositedWeis is not stored correctly");

                    //Check balances
                    const operatorInstanceBalance = await web3.eth.getBalance(operatorInstance.address);
                    const operatorPaymentBalance = await operatorInstance.getPayment(operator);
                    const vehicle3PaymentBalance = await operatorInstance.getPayment(vehicle3);
                    assert.strictEqual(operatorInstanceBalance.toString(10),
                        toBN(deposit1).add(toBN(deposit2)).add(toBN(deposit3)).toString(10),
                        "contract balance is not correct"
                    );
                    assert.strictEqual(
                        operatorPaymentBalance.toString(10),
                        '0',
                        "operator payment balance is not correct");
                    assert.strictEqual(
                        vehicle3PaymentBalance.toString(10),
                        '0',
                        "vehicle payment balance is not correct"
                    );

                    assert.strictEqual(
                        (await operatorInstance.getPendingPaymentCount(booth2, booth1)).toNumber(),
                        1,
                        "pending payment amount is not correct"
                    );
                });

                it("should be possible to more than one pending payment", async () => {
                    const thisRoutePrice = await operatorInstance.getRoutePrice(booth2, booth1);
                    assert.strictEqual(thisRoutePrice.toString(10), '0', "this test is incorrect");

                    await operatorInstance.enterRoad(booth2, secret3Hash, {from: vehicle3, value: deposit3});
                    await operatorInstance.enterRoad(booth2, secret4Hash, {from: vehicle1, value: deposit1});
                    await operatorInstance.enterRoad(booth2, secret5Hash, {from: vehicle2, value: deposit2});

                    await operatorInstance.reportExitRoad(secret3, {from: booth1});
                    await operatorInstance.reportExitRoad(secret4, {from: booth1});
                    await operatorInstance.reportExitRoad(secret5, {from: booth1});

                    const pendingPayments = await operatorInstance.getPendingPaymentCount(booth2, booth1);
                    assert.strictEqual(pendingPayments.toNumber(), 3, "pending payment amount is not correct");
                });

                it("should be possible to clear one pending payment (FIFO) when setting a route price", async () => {
                    const thisRoutePrice = await operatorInstance.getRoutePrice(booth2, booth1);
                    assert.strictEqual(thisRoutePrice.toString(10), '0', "this test is incorrect");

                    await operatorInstance.enterRoad(booth2, secret3Hash, {from: vehicle3, value: deposit3});
                    await operatorInstance.enterRoad(booth2, secret4Hash, {from: vehicle1, value: deposit1});
                    await operatorInstance.enterRoad(booth2, secret5Hash, {from: vehicle2, value: deposit2});

                    await operatorInstance.reportExitRoad(secret3, {from: booth1});
                    await operatorInstance.reportExitRoad(secret4, {from: booth1});
                    await operatorInstance.reportExitRoad(secret5, {from: booth1});

                    const pendingPaymentsBefore = await operatorInstance.getPendingPaymentCount(booth2, booth1);
                    assert.strictEqual(pendingPaymentsBefore.toNumber(), 3, "pending payment amount is not correct");

                    const txObj = await operatorInstance.setRoutePrice(booth2, booth1, standardRoutePrice, {from: operator});
                    assert.strictEqual(txObj.logs.length, 2, "two events should be emitted during setting route price");

                    const exitFee = toBN(standardRoutePrice).mul(toBN(multiplier3));

                    //Check logs
                    truffleAssert.eventEmitted(txObj, 'LogRoadExited');
                    const logExitBooth          = txObj.receipt.logs[1].args.exitBooth;
                    const logExitSecretHashed   = txObj.receipt.logs[1].args.exitSecretHashed;
                    const logFinalFee           = txObj.receipt.logs[1].args.finalFee;
                    const logRefundWeis         = txObj.receipt.logs[1].args.refundWeis;

                    assert.strictEqual(logExitBooth, booth1, "exitBooth was not logged correctly");
                    assert.strictEqual(logExitSecretHashed, secret3Hash, "exitSecretHashed was not logged correctly");
                    assert.strictEqual(
                        logFinalFee.toString(10),
                        exitFee.toString(10),
                        "finalFee was not logged correctly"
                    );
                    assert.strictEqual(
                        logRefundWeis.toString(10),
                        '0',
                        "refundWeis was not logged correctly"
                    );

                    const pendingPaymentsAfter = await operatorInstance.getPendingPaymentCount(booth2, booth1);
                    assert.strictEqual(pendingPaymentsAfter.toNumber(), 2, "pending payment amount is not correct");
                });

            });

        });

        describe("function setRoutePrice() - overwritten from RoutePriceHolder", async () => {

            it("should fail if value is sent along", async () => {
                await truffleAssert.fails(
                    operatorInstance.setRoutePrice(booth2, booth1, standardRoutePrice, {from: operator, value: 1})
                );
            });

            it("it should, if relevant, release 1 pending payment for this route", async () => {
                await operatorInstance.enterRoad(booth2, secret1Hash, {from: vehicle1, value: deposit1});
                await operatorInstance.reportExitRoad(secret1, {from: booth1});

                const pendingPaymentsBefore = await operatorInstance.getPendingPaymentCount(booth2, booth1);
                assert.strictEqual(pendingPaymentsBefore.toNumber(), 1, "pending payment amount is not correct");

                const txObj = await operatorInstance.setRoutePrice(booth2, booth1, standardRoutePrice, {from: operator});
                assert.strictEqual(txObj.logs.length, 2, "two events should be emitted during setting route price");

                const pendingPaymentsAfter = await operatorInstance.getPendingPaymentCount(booth2, booth1);
                assert.strictEqual(pendingPaymentsAfter.toNumber(), 0, "pending payment amount is not correct");
            });

            it("should not process one pending payment aren't any", async () => {
                const pendingPaymentsBefore = await operatorInstance.getPendingPaymentCount(booth2, booth1);
                assert.strictEqual(pendingPaymentsBefore.toNumber(), 0, "pending payment amount is not correct");

                const txObj = await operatorInstance.setRoutePrice(booth2, booth1, standardRoutePrice, {from: operator});
                assert.strictEqual(txObj.logs.length, 1, "one events should be emitted during setting route price");
            });

            it("should be possible to call it even when the contract is in the `true` paused state", async () => {
                await operatorInstance.setPaused(true, {from: operator});

                const txObj = await operatorInstance.setRoutePrice(booth2, booth1, standardRoutePrice, {from: operator});
                assert.strictEqual(txObj.logs.length, 1, "one events should be emitted during setting route price");
            })

        });

        describe("function clearSomePendingPayments()", async () => {

            beforeEach("create queue", async () => {
                await operatorInstance.enterRoad(booth2, secret1Hash, {from: vehicle1, value: deposit1});
                await operatorInstance.enterRoad(booth2, secret2Hash, {from: vehicle2, value: deposit2});
                await operatorInstance.enterRoad(booth2, secret3Hash, {from: vehicle3, value: deposit3});

                await operatorInstance.reportExitRoad(secret1, {from: booth1});
                await operatorInstance.reportExitRoad(secret2, {from: booth1});
                await operatorInstance.reportExitRoad(secret3, {from: booth1});

                await operatorInstance.setRoutePrice(booth2, booth1, standardRoutePrice, {from: operator});
            });

            it("should have a queue", async () => {
                const pendingPayments = await operatorInstance.getPendingPaymentCount(booth2, booth1);
                assert.strictEqual(pendingPayments.toNumber(), 2, "pending payment amount is not correct");
            });

            it("should fail if value is sent along", async () => {
                await truffleAssert.fails(
                    operatorInstance.clearSomePendingPayments(booth2, booth1, 2, {from: sender, value: 1})
                );
            });

            it("should fail if the contract is in the `true` paused state", async () => {
                await operatorInstance.setPaused(true, {from: operator});

                await truffleAssert.reverts(
                    operatorInstance.clearSomePendingPayments(booth2, booth1, 2, {from: sender}),
                    "Pausable: Contract is paused"
                );
            });

            it("should fail if booths are not really booths", async () => {
                await truffleAssert.reverts(
                    operatorInstance.clearSomePendingPayments(sender, booth1, 2, {from: sender}),
                    "TollBoothOperator: Booths are not really booths"
                );

                await truffleAssert.reverts(
                    operatorInstance.clearSomePendingPayments(booth2, sender, 2, {from: sender}),
                    "TollBoothOperator: Booths are not really booths"
                );
            });

            it("should fail if no route price is given", async () => {
                await truffleAssert.reverts(
                    operatorInstance.clearSomePendingPayments(booth3, booth1, 2, {from: sender}),
                    "TollBoothOperator: A base route price must be given"
                );
            });

            it("should fail if count argument is 0", async () => {
                await truffleAssert.reverts(
                    operatorInstance.clearSomePendingPayments(booth2, booth1, 0, {from: sender}),
                    "TollBoothOperator: Count cannot be 0"
                );
            });

            it("should fail if there are fewer than `count` pending payments that are solvable", async () => {
                const pendingPaymentsBefore = await operatorInstance.getPendingPaymentCount(booth2, booth1);
                const countArgument = toBN(pendingPaymentsBefore).add(toBN(1));

                await truffleAssert.reverts(
                    operatorInstance.clearSomePendingPayments(booth2, booth1, countArgument, {from: sender}),
                    "TollBoothOperator: There are fewer than count pending payments"
                );

                const pendingPaymentsAfter = await operatorInstance.getPendingPaymentCount(booth2, booth1);
                assert.strictEqual(pendingPaymentsBefore.toNumber(), pendingPaymentsAfter.toNumber(), "queue did not keep the same length");
            });

            it("should be possible to process all entries in a queue", async () => {
                const pendingPaymentsBefore = await operatorInstance.getPendingPaymentCount(booth2, booth1);

                const returned = await operatorInstance.clearSomePendingPayments.call(booth2, booth1, pendingPaymentsBefore.toNumber(), {from: sender});
                assert.isTrue(returned, "pending payments cannot be cleared");

                const txObj = await operatorInstance.clearSomePendingPayments(booth2, booth1, pendingPaymentsBefore.toNumber(), {from: sender});
                assert.strictEqual(txObj.logs.length, pendingPaymentsBefore.toNumber(), "events should be emitted during this process");

                const thisRoutePrice = await operatorInstance.getRoutePrice(booth2, booth1);
                const exitFee1 = toBN(thisRoutePrice).mul(toBN(multiplier1));
                const exitFee2 = toBN(thisRoutePrice).mul(toBN(multiplier2));
                const exitFee3 = toBN(thisRoutePrice).mul(toBN(multiplier3));

                //Check logs
                truffleAssert.eventEmitted(txObj, 'LogRoadExited');
                const logExitBooth2          = txObj.receipt.logs[0].args.exitBooth;
                const logExitBooth3          = txObj.receipt.logs[1].args.exitBooth;
                const logExitSecretHashed2   = txObj.receipt.logs[0].args.exitSecretHashed;
                const logExitSecretHashed3   = txObj.receipt.logs[1].args.exitSecretHashed;
                const logFinalFee2           = txObj.receipt.logs[0].args.finalFee;
                const logFinalFee3           = txObj.receipt.logs[1].args.finalFee;
                const logRefundWeis2         = txObj.receipt.logs[0].args.refundWeis;
                const logRefundWeis3         = txObj.receipt.logs[1].args.refundWeis;

                assert.strictEqual(logExitBooth2, booth1, "exitBooth was not logged correctly");
                assert.strictEqual(logExitBooth3, booth1, "exitBooth was not logged correctly");
                assert.strictEqual(logExitSecretHashed2, secret2Hash, "exitSecretHashed was not logged correctly");
                assert.strictEqual(logExitSecretHashed3, secret3Hash, "exitSecretHashed was not logged correctly");
                assert.strictEqual(
                    logFinalFee2.toString(10),
                    exitFee2.toString(10),
                    "finalFee was not logged correctly"
                );
                assert.strictEqual(
                    logFinalFee3.toString(10),
                    exitFee3.toString(10),
                    "finalFee was not logged correctly"
                );
                assert.strictEqual(
                    logRefundWeis2.toString(10),
                    toBN(deposit2).sub(toBN(exitFee2)).toString(10),
                    "refundWeis was not logged correctly"
                );
                assert.strictEqual(
                    logRefundWeis3.toString(10),
                    toBN(deposit3).sub(toBN(exitFee3)).toString(10),
                    "refundWeis was not logged correctly"
                );

                const pendingPaymentsAfter = await operatorInstance.getPendingPaymentCount(booth2, booth1);
                assert.strictEqual(pendingPaymentsAfter.toNumber(), 0, "pending payment amount is not correct");

                //Check storages - all values should have been deleted except entryBooth
                const vehicleEntries1 = await operatorInstance.getVehicleEntry(secret1Hash);
                const vehicleEntries2 = await operatorInstance.getVehicleEntry(secret2Hash);
                const vehicleEntries3 = await operatorInstance.getVehicleEntry(secret3Hash);

                assert.strictEqual(vehicleEntries1.vehicle, zeroAddress, "vehicle should have been deleted");
                assert.strictEqual(vehicleEntries2.vehicle, zeroAddress, "vehicle should have been deleted");
                assert.strictEqual(vehicleEntries3.vehicle, zeroAddress, "vehicle should have been deleted");

                assert.strictEqual(vehicleEntries1.entryBooth, booth2, "entryBooth should be kept");
                assert.strictEqual(vehicleEntries2.entryBooth, booth2, "entryBooth should be kept");
                assert.strictEqual(vehicleEntries3.entryBooth, booth2, "entryBooth should be kept");

                assert.strictEqual(vehicleEntries1.multiplier.toString(10), '0', "vehicle should have been deleted");
                assert.strictEqual(vehicleEntries2.multiplier.toString(10), '0', "vehicle should have been deleted");
                assert.strictEqual(vehicleEntries3.multiplier.toString(10), '0', "vehicle should have been deleted");

                assert.strictEqual(vehicleEntries1.depositedWeis.toString(10), '0', "depositedWeis should have been deleted");
                assert.strictEqual(vehicleEntries2.depositedWeis.toString(10), '0', "depositedWeis should have been deleted");
                assert.strictEqual(vehicleEntries3.depositedWeis.toString(10), '0', "depositedWeis should have been deleted");

                //Check balances
                const operatorInstanceBalance = await web3.eth.getBalance(operatorInstance.address);
                const operatorPaymentBalance = await operatorInstance.getPayment(operator);
                const vehicle1PaymentBalance = await operatorInstance.getPayment(vehicle1);
                const vehicle2PaymentBalance = await operatorInstance.getPayment(vehicle2);
                const vehicle3PaymentBalance = await operatorInstance.getPayment(vehicle3);

                assert.strictEqual(
                    operatorInstanceBalance.toString(10),
                    toBN(deposit1).add(toBN(deposit2)).add(toBN(deposit3)).toString(10),
                    "contract balance is not correct"
                );
                assert.strictEqual(
                    operatorPaymentBalance.toString(10),
                    toBN(exitFee1).add(toBN(exitFee2)).add(toBN(exitFee3)).toString(10),
                    "operator payment balance is not correct");

                assert.strictEqual(
                    vehicle1PaymentBalance.toString(10),
                    toBN(deposit1).sub(toBN(exitFee1)).toString(10),
                    "vehicle payment balance is not correct"
                );
                assert.strictEqual(
                    vehicle2PaymentBalance.toString(10),
                    toBN(deposit2).sub(toBN(exitFee2)).toString(10),
                    "vehicle payment balance is not correct"
                );
                assert.strictEqual(
                    vehicle3PaymentBalance.toString(10),
                    toBN(deposit3).sub(toBN(exitFee3)).toString(10),
                    "vehicle payment balance is not correct"
                );
            });

        });

        describe("function withdrawPayment()", async () => {
            beforeEach("create queue", async () => {
                await operatorInstance.enterRoad(booth1, secret2Hash, {from: vehicle2, value: deposit2});

                await operatorInstance.reportExitRoad(secret2, {from: booth2});
            });

            it("should fail if value is sent along", async () => {
                await truffleAssert.fails(
                    operatorInstance.withdrawPayment({from: operator, value: 1})
                );
            });

            it("should fail if the contract is in the `true` paused state", async () => {
                await operatorInstance.setPaused(true, {from: operator});

                await truffleAssert.reverts(
                    operatorInstance.withdrawPayment({from: operator}),
                    "Pausable: Contract is paused"
                );
            });

            it("should be possible possible to withdraw", async () => {
                const thisRoutePrice = await operatorInstance.getRoutePrice(booth1, booth2);
                const exitFee = toBN(thisRoutePrice).mul(toBN(multiplier2));
                const refund = toBN(deposit2).sub(toBN(exitFee));

                const operatorEOAbalanceBefore = await web3.eth.getBalance(operator);
                const vehicle2EOAbalanceBefore = await web3.eth.getBalance(vehicle2);

                const operatorInstanceBalanceBefore = await web3.eth.getBalance(operatorInstance.address);
                const operatorPaymentBalanceBefore = await operatorInstance.getPayment(operator);
                const vehiclePaymentBalanceBefore = await operatorInstance.getPayment(vehicle2);

                assert.strictEqual(
                    operatorInstanceBalanceBefore.toString(10),
                    deposit2.toString(10),
                    "contract balance is not correct"
                );
                assert.strictEqual(
                    operatorPaymentBalanceBefore.toString(10),
                    exitFee.toString(10),
                    "operator payment balance is not correct"
                );
                assert.strictEqual(
                    vehiclePaymentBalanceBefore.toString(10),
                    refund.toString(10),
                    "vehicle payment balance is not correct"
                );

                //Withdraw by vehicle2
                const returned1 = await operatorInstance.withdrawPayment.call({from: vehicle2});
                assert.isTrue(returned1, "payment cannot be withdrawn");

                const txObj1 = await operatorInstance.withdrawPayment({from: vehicle2});

                const tx1 = await web3.eth.getTransaction(txObj1.tx);
                const txFee1 = toBN(tx1.gasPrice).mul(toBN(txObj1.receipt.gasUsed));

                //Check logs
                truffleAssert.eventEmitted(txObj1, 'LogPaymentWithdrawn');
                const logToWhom1    = txObj1.receipt.logs[0].args.toWhom;
                const logAmount1    = txObj1.receipt.logs[0].args.amount;

                assert.strictEqual(logToWhom1, vehicle2, "toWhom was not logged correctly");
                assert.strictEqual(
                    logAmount1.toString(10),
                    refund.toString(10),
                    "amount was not logged correctly"
                );

                //Check internal balances
                const operatorInstanceBalanceAfter1 = await web3.eth.getBalance(operatorInstance.address);
                const operatorPaymentBalanceAfter1 = await operatorInstance.getPayment(operator);
                const vehiclePaymentBalanceAfter1 = await operatorInstance.getPayment(vehicle2);

                assert.strictEqual(
                    operatorInstanceBalanceAfter1.toString(10),
                    toBN(deposit2).sub(toBN(refund)).toString(10),
                    "contract balance is not correct"
                );
                assert.strictEqual(
                    operatorPaymentBalanceAfter1.toString(10),
                    operatorPaymentBalanceBefore.toString(10),
                    "operator payment balance is not correct"
                );
                assert.strictEqual(
                    vehiclePaymentBalanceAfter1.toString(10),
                    '0',
                    "vehicle payment balance is not correct"
                );

                //Check external balances
                const vehicle2EOAbalanceAfter = await web3.eth.getBalance(vehicle2);
                assert.strictEqual(
                    vehicle2EOAbalanceAfter.toString(10),
                    toBN(vehicle2EOAbalanceBefore).add(toBN(refund)).sub(toBN(txFee1)).toString(10),
                    "vehicles balance is not correct"
                );

                //Withdraw by operator
                const returned2 = await operatorInstance.withdrawPayment.call({from: operator});
                assert.isTrue(returned2, "payment cannot be withdrawn");

                const txObj2 = await operatorInstance.withdrawPayment({from: operator});

                const tx2 = await web3.eth.getTransaction(txObj2.tx);
                const txFee2 = toBN(tx2.gasPrice).mul(toBN(txObj2.receipt.gasUsed));

                //Check logs
                truffleAssert.eventEmitted(txObj2, 'LogPaymentWithdrawn');
                const logToWhom2    = txObj2.receipt.logs[0].args.toWhom;
                const logAmount2    = txObj2.receipt.logs[0].args.amount;

                assert.strictEqual(logToWhom2, operator, "toWhom was not logged correctly");
                assert.strictEqual(
                    logAmount2.toString(10),
                    exitFee.toString(10),
                    "amount was not logged correctly"
                );

                //Check internal balances
                const operatorInstanceBalanceAfter2 = await web3.eth.getBalance(operatorInstance.address);
                const operatorPaymentBalanceAfter2 = await operatorInstance.getPayment(operator);
                const vehiclePaymentBalanceAfter2 = await operatorInstance.getPayment(vehicle2);

                assert.strictEqual(
                    operatorInstanceBalanceAfter2.toString(10),
                    '0',
                    "contract balance is not correct"
                );
                assert.strictEqual(
                    operatorPaymentBalanceAfter2.toString(10),
                    '0',
                    "operator payment balance is not correct"
                );
                assert.strictEqual(
                    vehiclePaymentBalanceAfter2.toString(10),
                    '0',
                    "vehicle payment balance is not correct"
                );

                //Check external balances
                const operatorEOAbalanceAfter = await web3.eth.getBalance(operator);
                assert.strictEqual(
                    operatorEOAbalanceAfter.toString(10),
                    toBN(operatorEOAbalanceBefore).add(exitFee).sub(toBN(txFee2)).toString(10),
                    "operators balance is not correct"
                );
            });

        });

    });

});